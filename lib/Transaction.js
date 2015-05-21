/**
 * Created by kyungmi.koong on 2015-05-21.
 */

'use strict';

var _ = require('lodash');
var async = require('async');
var DBException = require('./db-error');
var dbConnection = require('./db-connection');

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
                            callback();
                        }
                    });
                }
            });
        }
        if(!_.isEmpty(tasks)){
            self.tasks = [firstTask].concat(_.map(tasks,function(task, key){
                return function(next){
                    var context = {
                        connector: self.connector,
                        connection: self.connection,
                        setData: function(data){
                            self.setData(key, data);
                        },
                        getData: function(key){
                            return self.getData(key);
                        }
                    };
                    task(context, next);
                };
            }));
        }
    })();
    return self;
}

Transaction.prototype.setData = function(key, data){
    this.data[key] = data;
};

Transaction.prototype.getData = function(key){
    return this.data[key];
};

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
                    if (_.isFunction(callback)) {
                        callback(new DBException(err));
                    }
                });
            } else {
                callback(new DBException(err, 'It is not in transactional state.'));
            }
        } else {
            if(self.transactional) {
                self.connector.endTransactionWithCommit(self.connection, function (err) {
                    if (err) {
                        self.connector.endTransactionWithRollback(self.connection, function () {
                            if (_.isFunction(callback)) {
                                callback(new DBException(err));
                            }
                        });
                    } else {
                        if (_.isFunction(callback)) {
                            callback(null, self);
                        }
                    }
                });
            } else {
                callback(new DBException(null, 'It is not in transactional state.'));
            }
        }
        if(self.connection) {
            self.connector.endConnection(self.connection);
        }
        delete self.tasks;
    });
};

module.exports = Transaction;