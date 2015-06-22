/**
 * Created by kyungmi.koong on 2015-05-21.
 */

'use strict';

var _ = require('lodash');
var async = require('async');
var DBError = require('./db-error');
var dbConnection = require('./db-connection');
var DBContext = require('./db-context');

function Transaction(){
    var tasks, connectorName;
    if(typeof arguments[0] === 'string'){
        connectorName = arguments[0];
        tasks = arguments[1];
    } else {
        tasks = arguments[0];
    }
    this.connector = dbConnection.getConnector(connectorName);
    this.tasks = null;
    this.connection = null;
    this.transactional = null;
    this.data = {};
    this.context = new DBContext(this.connector);
    var self = this;

    (function init() {
        function firstTask(callback) {
            self.connector.beginConnection(function (err, connection) {
                if (err) {
                    callback(err);
                } else {
                    self.connection = connection;
                    self.context.connection = connection;
                    self.connector.beginTransaction(self.connection, function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            self.transactional = true;
                            callback(null, self.context);
                        }
                    });
                }
            });
        }
        if(!_.isEmpty(tasks)){
            self.tasks = [firstTask].concat(tasks);
        }
    })();
    return self;
}

/*
 Transaction.prototype.setData = function(key, data){
 this.data[key] = data;
 };

 Transaction.prototype.getData = function(key){
 return this.data[key];
 };
 */

Transaction.prototype.start = function(callback) {
    var self = this;

    if(_.isEmpty(self.tasks)){
        if(callback){
            callback('no tasks');
        }
        return;
    }

    async.waterfall(self.tasks, function(err){
        if(err){
            if(self.transactional) {
                self.connector.endTransactionWithRollback(self.connection, function () {
                    if(self.connection) {
                        self.connector.endConnection(self.connection);
                    }
                    if (_.isFunction(callback)) {
                        callback(new DBError(err, 'transaction is rollbacked because of an error'));
                    }
                });
            } else {
                if(self.connection) {
                    self.connector.endConnection(self.connection);
                }
                callback(new DBError(err, 'It is not in transactional state.'));
            }
        } else {
            if(self.transactional) {
                self.connector.endTransactionWithCommit(self.connection, function (err) {
                    if (err) {
                        self.connector.endTransactionWithRollback(self.connection, function () {
                            if(self.connection) {
                                self.connector.endConnection(self.connection);
                            }
                            if (_.isFunction(callback)) {
                                callback(new DBError(err, 'An error occurred while commit transaction'));
                            }
                        });
                    } else {
                        if(self.connection) {
                            self.connector.endConnection(self.connection);
                        }
                        if (_.isFunction(callback)) {
                            callback(null, self.context);
                        }
                    }
                });
            } else {
                if(self.connection) {
                    self.connector.endConnection(self.connection);
                }
                callback(new DBError(null, 'It is not in transactional state.'));
            }
        }
        delete self.tasks;
    });
};

module.exports = Transaction;