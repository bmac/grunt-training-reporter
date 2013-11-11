/*
 * grunt-reporter
 * https://github.com/bmac/grunt-reporter
 *
 * Copyright (c) 2013 bmac
 * Licensed under the MIT license.
 */

'use strict';

var prompt = require('prompt'),
    Q = require('q'),
    fs = require('fs'),
    _ = require('lodash'),
    request = require('superagent');


// attempts to read the token from the file
var readTokenFromFile = function(fileName) {
  return Q.ninvoke(fs, 'readFile', fileName, 'utf8');
};

var writeTokenToFile = function(token, fileName) {
  return Q.ninvoke(fs, 'writeFile', fileName, token).then(function() {
    return token;
  });
};

var requestNewToken = function(options) {
  var schema = {
    properties: {
      username: {
        pattern: /^[a-zA-Z\s\-]+$/,
        message: 'Name must be only letters, spaces, or dashes',
        required: true
      },
      password: {
        hidden: true
      }
    }
  };
  prompt.start();
  return Q.ninvoke(prompt, 'get', schema).then(function(arg) {
    return Q.ninvoke(request.post(options.tokenRequestUri)
        .send({
          username: arg.username,
          password: arg.password,
          // client_id: options.client_id,
          // // Not Really a secret but the passport library requires this param
          // client_secret: options.client_secret,
          grant_type: 'password'
        }), 'end');
  }).then(function(arg) {
    if (arg.status !== 200) {
      throw arg.text;
    }
    return arg.body.access_token.token;
  });
};



var getToken = function(options) {
  return readTokenFromFile(options.tokenFile).then(null, function() {
    // Error case, request a new token then save it to the file
    return requestNewToken(options).then(function(token) {
      return writeTokenToFile(token, options.tokenFile);
    });
  });
};


var getTestStats = function(testOutputFile) {
  return Q.ninvoke(fs, 'readFile', testOutputFile, 'utf8').then(function(output) {
    var stats = JSON.parse(output).stats;
    stats.name = process.cwd().split('/').pop();
    return stats;
  });
};

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('reporter', 'The best Grunt plugin ever.', function() {

    var done = this.async();

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      tokenFile: '.accessToken',
      testOutputFile: 'out.json',
      tokenRequestUri: 'http://localhost:1337/oauth/token',
      testReportUri: 'http://localhost:1337/testResult'
    });

    // Find local auth token.
    // If it does not exist request username and password
    // request and store new auth token.

    var token = getToken(options);

    // Get tests results
    // Process tests results

    var testStats = getTestStats(options.testOutputFile);

    // Using auth token post results
    Q.all([token, testStats]).then(function(results) {
      var token = results[0], 
          testResults = results[1],
          params = _.extend({
          access_token: token
        }, testResults);

      request
        .post(options.testReportUri)
        .send(params)
        .end(function(err, res) {
          done(err);
        });
    }, done);
  });
};
