(function () {
  'use strict';

  /** admiralApiAdapter
   *  Used for calling API routes
   */

  admiral.factory('admiralApiAdapter', ['admiralService',
    admiralApiAdapter
  ]);

  function admiralApiAdapter(admiralService) {
    var API = admiralService;
    return {
      // Admiral Routes
      getAdmiralEnv: function (callback) {
        return API.get('/api/admiral', callback);
      },
      //  Auth Routes
      postAuth: function (body, callback) {
        return API.post('/api/auth', body, callback);
      },
      postLogout: function (body, callback) {
        return API.post('/api/logout', body, callback);
      },
      // System Config Routes
      getSystemConfigs: function (callback) {
        return API.get('/api/systemConfigs', callback);
      },
      // System Integration Routes
      getSystemIntegrations: function (query, callback) {
        return API.get('/api/systemIntegrations?' + query, callback);
      },
      postSystemIntegration: function (body, callback) {
        return API.post('/api/systemIntegrations', body, callback);
      },
      // Service Routes
      postInitialize: function (body, callback) {
        return API.post('/api/workflow/initialize', body, callback);
      },
      postSecrets: function (body, callback) {
        return API.post('/api/secrets', body, callback);
      },
      getService: function(component, callback) {
        return API.get('/api/' + component, callback);
      },
      // logs
      getServiceLogs: function(component, callback) {
        return API.get('/api/' + component + '/logs', callback);
      }
    };
  }
}());
