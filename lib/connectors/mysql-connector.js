/**
 * Created by kyungmi.koong on 2015-05-19.
 */

'use strict';

var mysql = require('mysql');

function MysqlConnector(options){
    var self = this;
    self.pool = mysql.createPool(options);

    self.pool.on('connection', function (connection) {
        connection.query('SET SESSION autocommit=1');
    });

    process.on('exit', function(/*code*/){
        self.pool.end();
    });
}

MysqlConnector.prototype.beginConnection = function(callback){
    this.pool.getConnection.call(this.pool, callback);
};

MysqlConnector.prototype.endConnection = function(connection){
    connection.release.call(connection, connection);
};

MysqlConnector.prototype.beginTransaction = function(connection, callback) {
    connection.beginTransaction.call(connection, callback);
};

MysqlConnector.prototype.endTransactionWithCommit = function(connection, callback){
    connection.commit.call(connection, callback);
};

MysqlConnector.prototype.endTransactionWithRollback = function(connection, callback){
    connection.rollback.call(connection, callback);
};

module.exports = MysqlConnector;