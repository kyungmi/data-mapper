/**
 * Created by kyungmi.koong on 2015-04-24.
 */

'use strict';

var mysql = require('mysql');

var pool = mysql.createPool({
    connectionLimit: 5,
    host: '172.21.101.124',
    user: 'test',
    password: 'test',
    database: 'test'/*,
    queryFormat: function (query, values) {
        if (!values) {
            return query;
        }
        return query.replace(/:(\w+)/g, function (txt, key) {
            if (values.hasOwnProperty(key)) {
                return this.escape(values[key]);
            }
            return txt;
        }.bind(this));
    }*/
});

pool.on('connection', function (connection) {
    connection.query('SET SESSION autocommit=1');
});

module.exports.init = function(connectorOption){

};

module.exports.beginConnection = pool.getConnection.bind(pool);

module.exports.endConnection = function(connection){
    connection.release.call(connection, connection);
};

module.exports.beginTransaction = function(connection, callback) {
    connection.beginTransaction.call(connection, callback);
};

module.exports.endTransactionWithCommit = function(connection, callback){
    connection.commit.call(connection, callback);
};

module.exports.endTransactionWithRollback = function(connection, callback){
    connection.rollback.call(connection, callback);
};

module.exports.getConnector = function(connectorName){
    return this;
};

process.on('exit', function(/*code*/){
    pool.end();
});