/**
 * Created by kyungmi.koong on 2015-04-23.
 */

'use strict';

var _ = require('lodash');
var logger = require('./log-manager');
var JSON5 = require('json5');
var fs = require('fs');
var Handlebars = require('handlebars');
var path = require('path');
var DBException = require('./db-error');
var queryUtil = require('./query-util');

var mappers = {};

Handlebars.registerHelper('where', function(options){
    var content = options.fn(this);
    return content.replace(/^\s*(WHERE)?\s+(AND|OR)?\s+(.*)$/i, 'WHERE $3');
});

Handlebars.registerHelper('set', function(options){
    var content = options.fn(this);
    return content.replace(/^\s*(set)?\s+,?(.*)$/i, 'SET $2');
});

function _logging(daoInfo, err, result) {
    if(daoInfo) {
        var prefix = 'Query [' + daoInfo.name + '.' + daoInfo.mapper + '] execution with params ';
        if (err) {
            logger.error(prefix, daoInfo.params, 'was failed: ', err);
        } else {
            logger.info(prefix, daoInfo.params, 'result: ', result);
        }
    } else {
        logger.error(err);
    }
}

/**
 * execute a query with a variety of options
 *
 * @param context   database connection context including connection object, query info and result data
 * @param callback  callback function that will be called after returning query result with db error and result set
 * @param options
 *      - closeConnection   whether close current database connection after returning query result or not
 *      - useContextOnly    whether callback function called with no result set or not
 * @private
 */
function _execute(context, callback, options) {
    context.connection.query(context.daoInfo.query, function (err, result) {
        if(options.closeConnection) {
            context.connector.endConnection(context.connection);
        }
        if(!err && result && _.isFunction(context.setData)){
            context.setData(result);
        }
        if(_.isFunction(callback)){
            if(options.useContextOnly){
                callback(err ? new DBException(err) : null);
            } else {
                callback(err ? new DBException(err) : null, result);
            }
        }
        _logging(context.daoInfo, err, result);
    });
}

function _executeQuery(context, callback){
    if(!context){
        callback('Invalid context');
        _logging(null, 'Invalid context');
        return;
    }

    if(!context.connection) {
        context.connector.beginConnection(function (err, newConn) {
            if (err) {
                callback(new DBException(err));
                _logging(context.daoInfo, err);
            } else {
                context.connection = newConn;
                _execute(context, callback, {closeConnection: true});
            }
        });
    } else {
        _execute(context, callback, {closeConnection: false});
    }
}

function _getExecutable(originalContext){
    return function (context, callback) {
        context = _.extend({}, originalContext, context);
        if(!context || !context.connection) {
            callback('Invalid context');
            _logging(null, 'Invalid context');
        } else {
            _execute(context, callback, {closeConnection: false, useContextOnly: true});
        }
    };
}

function _checkArguments(args) {
    var params = {}, context, callback;
    if (args.length > 0) {
        params = (_.isPlainObject(args[0])) ? args[0] : {};
        if (args.length > 1) {
            if (_.isFunction(args[1])) {
                callback = args[1];
            } else {
                context = args[1];
            }
            if (args.length > 2) {
                context = args[2];
            }
        }
    }
    return {params: params, context: context, callback: callback};
}

function _makeDaoMethod(dao, methodName, sql){
    return function () {
        var args = _checkArguments(arguments);
        var template = Handlebars.compile(sql);

        args.context = args.context || {};
        args.context.daoInfo = {
            name: dao._name,
            mapper: methodName,
            sql: sql,
            params: args.params,
            query: template(args.params)
        };
        if (!args.context.connector) {
            args.context.connector = dao._connector;
        }
        return args.callback ? _executeQuery(args.context, args.callback) : _getExecutable(args.context);
    };
}

function Mapper(mapperName, options) {
    this._options = options;
    this._name = mapperName;
    this._file = (typeof options === 'object') ? options.file : options;
    this._queries = {};
    this._maps = {};
    this._connector = null;
}

Mapper.prototype.addDefaultMethod = function(){
    var self = this;
    self.$save = _makeDaoMethod(self, '$save', queryUtil.generate('save', self._defaultMap));
};

Mapper.prototype.makeMappers = function(){
    var self = this;
    _.forEach(self._queries, function(sql, methodName){
        /**
         * auto generated query execution methods for each DAO
         * @example
         *      ...
         *      var Transaction = dataMapper.Transaction;
         *      var userDao = dataMapper.dao('user');
         *      ...
         *      var transaction = new Transaction( [ userDao.findUser({userId: 1234}), ... ] );
         *      ...
         *      userDao.findUser({userId: 1234}, function(err, result){ ... });
         *      ...
         *      var executable = userDao.findUser({userId: 1234}, connection);
         *      executable(function(err, result){ ... });
         *      ...
         *      userDao.findUser({userId: 1234},
         *      ...
         * @returns return type depends on the arguments
         *      ([params])
         *          => returns query executable function(callback) in transactional job
         *      ([params,] callback)
         *          => execute query with a new connection
         *      (params, context)
         *          => returns query executable function(callback) with existing connection context
         *      (params, callback, context)
         *          => execute query with existing connection context
         */
        self[methodName] = _makeDaoMethod(self, methodName, sql);
    });
};

Mapper.prototype.readConfiguration = function(){
    var self = this;
    if(!self._fileLoaded) {
        var file = (typeof self._options === 'object') ? self._options.file : self._options;
        try {
            var confDir = process.env.DATA_MAPPER_CONF_PATH || process.cwd();
            var content = fs.readFileSync(path.resolve(confDir, file), 'utf8');
            self.configuration = JSON5.parse(content);
            self._maps = self.configuration.maps;
            self._defaultMap = self._maps.default;
            self._queries = self.configuration.queries;
            self.addDefaultMethod();
            self.makeMappers();
            self._fileLoaded = true;
        } catch (e) {
            if(e.code === 'ENOENT'){
                logger.error(self.name + ' mapper configuration file not found: ' + file);
            } else {
                logger.error('Unknown error occurred: ', e);
            }
        }
    }
};

Mapper.prototype.setConnector = function(connector){
    this._connector = connector;
};

var initialized = false;

module.exports.init = function(mapperOptions){
    if(mapperOptions && !initialized) {
        for (var mapperName in mapperOptions) {
            if (mapperOptions.hasOwnProperty(mapperName)) {
                mappers[mapperName] = new Mapper(mapperName, mapperOptions[mapperName]);
            }
        }
        initialized = false;
    } else if(!mapperOptions){
        console.warn('mapper options should be not empty.');
    } else {
        console.warn('dao has been already initialized.');
    }
};

module.exports.getMapper = function(mapperName, dbConnector){
    if(mappers[mapperName]){
        var mapper = mappers[mapperName];
        mapper.setConnector(dbConnector);
        mapper.readConfiguration();
        return mapper;
    }
};