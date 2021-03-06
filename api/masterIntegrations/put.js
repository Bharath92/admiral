'use strict';

var self = put;
module.exports = self;

var async = require('async');
var _ = require('underscore');
var path = require('path');
var fs = require('fs');

var APIAdapter = require('../../common/APIAdapter.js');

function put(req, res) {
  var bag = {
    inputParams: req.params,
    reqQuery: req.query,
    reqBody: req.body,
    apiAdapter: new APIAdapter(req.headers.authorization.split(' ')[1]),
    resBody: {},
    defaultReplicas: 1
  };

  bag.who = util.format('masterIntegrations|%s', self.name);
  logger.info(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _put.bind(null, bag),
      _getMasterIntegration.bind(null, bag),
      _getServicesList.bind(null, bag),
      _getIntegrationServicesMap.bind(null, bag),
      _getEnabledIntegrations.bind(null, bag),
      _filterEnabledIntegrationServices.bind(null, bag),
      _getIntegrationServices.bind(null, bag),
      _startIntegrationServices.bind(null, bag),
      _stopIntegrationServices.bind(null, bag)
    ],
    function (err) {
      logger.info(bag.who, 'Completed');
      if (err)
        return respondWithError(res, err);

      sendJSONResponse(res, bag.resBody);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (!bag.reqBody)
    return next(
      new ActErr(who, ActErr.BodyNotFound, 'Missing body')
    );

  if (!bag.inputParams.masterIntegrationId)
    return next(
      new ActErr(who, ActErr.ParamNotFound,
        'Route param not found :masterIntegrationId')
    );

  if (!_.isBoolean(bag.reqBody.isEnabled))
    return next(
      new ActErr(who, ActErr.DataNotFound,
        'Missing body data or wrong type :isEnabled')
    );

  return next();
}

function _put(bag, next) {
  var who = bag.who + '|' + _put.name;
  logger.verbose(who, 'Inside');

  var query = util.format('UPDATE "masterIntegrations" SET "isEnabled"=%s ' +
    'WHERE id=\'%s\'',
    bag.reqBody.isEnabled, bag.inputParams.masterIntegrationId);

  global.config.client.query(query,
    function (err) {
      if (err)
        return next(
          new ActErr(who, ActErr.DBOperationFailed,
            'Failed to enable masterIntegration with error: ' +
            util.inspect(err))
        );

      return next();
    }
  );
}

function _getMasterIntegration(bag, next) {
  var who = bag.who + '|' + _getMasterIntegration.name;
  logger.verbose(who, 'Inside');

  var query = util.format('SELECT * FROM "masterIntegrations" WHERE id=\'%s\'',
    bag.inputParams.masterIntegrationId);

  global.config.client.query(query,
    function (err, masterIntegrations) {
      if (err)
        return next(
          new ActErr(who, ActErr.DBOperationFailed,
            'Failed to find masterIntegration with error: ' +
            util.inspect(err))
        );

      if (_.isEmpty(masterIntegrations.rows))
        return next(
          new ActErr(who, ActErr.DBEntityNotFound,
            'Master Integration not found for masterIntegrationId: ' +
             bag.inputParams.masterIntegrationId)
        );

      logger.debug('Found master integration for ' +
        bag.inputParams.masterIntegrationId);

      bag.resBody = masterIntegrations.rows[0];
      return next();
    }
  );
}

function _getServicesList(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  var who = bag.who + '|' + _getServicesList.name;
  logger.verbose(who, 'Inside');

  var query = '';
  bag.apiAdapter.getServices(query,
    function (err, services) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Failed to get services with error: ' + util.inspect(err))
        );

      // only get non-global service list
      bag.services = _.filter(services,
        function (service) {
          return !service.isCore;
        }
      );

      return next();
    }
  );
}

function _getIntegrationServicesMap(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  var who = bag.who + '|' + _getIntegrationServicesMap.name;
  logger.verbose(who, 'Inside');

  var servicesJsonPath =
    path.join(global.config.scriptsDir, '/configs/services.json');

  fs.readFile(servicesJsonPath,
    function (err, data) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Failed to get services.json with error: ' + util.inspect(err))
        );

      var error;
      var services = {};

      try {
        services = JSON.parse(data);
      } catch (err) {
        if (err)
          error = new ActErr(who, ActErr.OperationFailed,
            util.format('Failed to parse services.json: %s', err)
          );
      }

      bag.servicesMap = services;
      return next(error);
    }
  );
}

function _getEnabledIntegrations(bag, next) {
  var who = bag.who + '|' + _getEnabledIntegrations.name;
  logger.verbose(who, 'Inside');

  var query = 'isEnabled=true';
  bag.apiAdapter.getMasterIntegrations(query,
    function (err, masterIntegrations) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Failed to get enabled master integrations with error: ' +
            util.inspect(err))
        );
      bag.enabledMasterIntegrations = masterIntegrations;

      return next();
    }
  );
}

function _filterEnabledIntegrationServices(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  var who = bag.who + '|' + _filterEnabledIntegrationServices.name;
  logger.verbose(who, 'Inside');

  var enabledMasterIntegrationServices = [];

  // find all services used by enabled master integrations
  _.each(bag.enabledMasterIntegrations,
    function (enabledMasterIntegration) {
      _.each(bag.servicesMap.integrationServices,
        function (service) {
          if (enabledMasterIntegration.name === service.name)
            enabledMasterIntegrationServices =
              enabledMasterIntegrationServices.concat(service.services);
        }
      );
    }
  );

  enabledMasterIntegrationServices = _.uniq(enabledMasterIntegrationServices);
  bag.enabledMasterIntegrationServices = enabledMasterIntegrationServices;

  return next();
}

function _getIntegrationServices(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  var who = bag.who + '|' + _getIntegrationServices.name;
  logger.verbose(who, 'Inside');

  var integrationServices = [];
  _.each(bag.servicesMap.integrationServices,
    function (integrationService) {
      if (integrationService.name === bag.resBody.name) {
        integrationServices =
          integrationServices.concat(integrationService.services);

        integrationServices = _.uniq(integrationServices);
      }
    }
  );

  bag.integrationServices = integrationServices;

  return next();
}

function _startIntegrationServices(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  if (!bag.reqBody.isEnabled) return next();

  var who = bag.who + '|' + _startIntegrationServices.name;
  logger.verbose(who, 'Inside');

  // enable services for this integration
  var enabledServices = [];
  _.each(bag.integrationServices,
    function (integrationService) {
      _.each(bag.services,
        function (service) {
          if (service.serviceName === integrationService &&
            service.isEnabled === false)
              enabledServices.push(service);
        }
      );
    }
  );

  async.each(enabledServices,
    function (enabledService, callback) {
      var data = {
        name: enabledService.serviceName,
        replicas: bag.defaultReplicas
      };

      bag.apiAdapter.postServices(data,
        function (err) {
          callback(err);
        }
      );
    },
    function (err) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Failed to start service: ' + util.inspect(err))
        );

      return next();
    }
  );
}

function _stopIntegrationServices(bag, next) {
  if (bag.reqQuery.skipServices) return next();
  if (bag.reqBody.isEnabled) return next();

  var who = bag.who + '|' + _stopIntegrationServices.name;
  logger.verbose(who, 'Inside');

  // disable services only if
  // - service corresponds to current integration
  // - service is not used by any enabled master integration
  var disabledServices = [];
  _.each(bag.integrationServices,
    function (integrationService) {
      _.each(bag.services,
        function (service) {
          if (service.serviceName === integrationService &&
            !_.contains(
              bag.enabledMasterIntegrationServices, service.serviceName))
            disabledServices.push(service);
        }
      );
    }
  );

  async.each(disabledServices,
    function (disabledService, callback) {

      bag.apiAdapter.deleteServices(disabledService.serviceName,
        function (err) {
          callback(err);
        }
      );
    },
    function (err) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Failed to disable service: ' + util.inspect(err))
        );

      return next();
    }
  );
}
