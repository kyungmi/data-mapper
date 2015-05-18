/**
 * Created by kyungmi.koong on 2015-05-15.
 */

'use strict';

var _ = require('lodash');
var dao = require('./dao');
var dbConnection = require('./db-connection');
var async = require('async');
var DBException = require('./db-error');

function Transaction(tasks){
    var self = this;

    (function init() {
        function firstTask(callback) {
            dbConnection.beginConnection(function (err, connection) {
                if (err) {
                    callback(err);
                } else {
                    self.connection = connection;
                    dbConnection.beginTransaction(self.connection, function (err) {
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
                dbConnection.endTransactionWithRollback(self.connection, function () {
                    // TODO error 처리
                    if (_.isFunction(callback)) {
                        callback(new DBException(err));
                    }
                });
            }
        } else {
            if(self.transactional) {
                dbConnection.endTransactionWithCommit(self.connection, function (err) {
                    if (err) {
                        dbConnection.endTransactionWithRollback(self.connection, function () {
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
            dbConnection.endConnection(self.connection);
        }
        delete self.tasks;
        delete self.connection;
        delete self.transactional;
    });
};

var initialized = false;
var dataMapperOptions = {connectors: {}, mappers: {}};
var defaultConnector;

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
        var connector = defaultConnector;
        if(typeof dataMapperOptions.mappers[mapperName] === 'object'){
            connector = dataMapperOptions.mappers[mapperName].connector || defaultConnector;
        }
        var dbConnector = dbConnection.getConnector(connector);
        return dao.getMapper(mapperName, dbConnector);
    }
};

module.exports.Transaction = Transaction;