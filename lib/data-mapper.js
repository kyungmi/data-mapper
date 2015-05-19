/**
 * Created by kyungmi.koong on 2015-05-15.
 */

'use strict';

var _ = require('lodash');
var dao = require('./dao');
var dbConnection = require('./db-connection');
var async = require('async');
var DBException = require('./db-error');

function Transaction(){
    var tasks, connectorName;
    if(typeof arguments[0] === 'string'){
        connectorName = arguments[0];
        tasks = arguments[1];
    } else {
        tasks = arguments[0];
    }
    this.connector = dbConnection.getConnector(connectorName);
    var self = this;

    (function init() {
        function firstTask(callback) {
            self.connector.beginConnection(function (err, connection) {
                if (err) {
                    callback(err);
                } else {
                    self.connection = connection;
                    self.connector.beginTransaction(self.connection, function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            self.transactional = true;
                            callback(null, connection, {});
                        }
                    });
                }
            });
        }
        if(!_.isEmpty(tasks)){
            self.tasks = [firstTask].concat(_.map(tasks,function(task){
                return task.bind(self);
            }));
        }
        self.connection = null;
        self.transactional = false;
    })();

    return self;
}

Transaction.prototype.start = function(callback) {
    var self = this;

    if(_.isEmpty(self.tasks)){
        if(callback){
            callback('no tasks');
        }
        return;
    }

    async.waterfall(self.tasks, function(err, connection, result){
        if(err){
            if(self.transactional) {
                self.connector.endTransactionWithRollback(self.connection, function () {
                    // TODO error 처리
                    if (_.isFunction(callback)) {
                        callback(new DBException(err));
                    }
                });
            }
        } else {
            if(self.transactional) {
                self.connector.endTransactionWithCommit(self.connection, function (err) {
                    if (err) {
                        self.connector.endTransactionWithRollback(self.connection, function () {
                            // TODO error 처리
                            if (_.isFunction(callback)) {
                                callback(new DBException(err));
                            }
                        });
                    } else {
                        if (_.isFunction(callback)) {
                            callback(null, result);
                        }
                    }
                });
            }
        }
        if(self.connection) {
            self.connector.endConnection(self.connection);
        }
        delete self.tasks;
        delete self.connection;
        delete self.transactional;
    });
};

var initialized = false;
var dataMapperOptions = {connectors: {}, mappers: {}};

module.exports.init = function(options){
    if(options && !initialized) {
        dataMapperOptions = _.extend(dataMapperOptions, options);
        dbConnection.init(dataMapperOptions.connectors);
        dao.init(dataMapperOptions.mappers);
        initialized = true;
    } else if(!options){
        console.warn('options should be not empty.');
    } else {
        console.warn('data-mapper has been already initialized.');
    }
    return this;
};

module.exports.dao = function(mapperName){
    if(!initialized){
        console.warn('Not initialized.');
    }
    if(dataMapperOptions.mappers[mapperName]){
        var connectorName = '';
        if(typeof dataMapperOptions.mappers[mapperName] === 'object'){
            connectorName = dataMapperOptions.mappers[mapperName].connector;
        }
        var dbConnector = dbConnection.getConnector(connectorName);
        return dao.getMapper(mapperName, dbConnector);
    }
};

module.exports.Transaction = Transaction;