/**
 * Created by kyungmi.koong on 2015-04-23.
 */

'use strict';

var _ = require('lodash');
var logger = require('./log-manager');
var JSON5 = require('json5');
var fs = require('fs');
var path = require('path');
var DBError = require('./db-error');
var compiler = require('./compiler');
var DBContext = require('./db-context');

var mappers = {};

function _logging(daoInfo, err, result) {
    if(daoInfo) {
        var prefix = 'Query [' + daoInfo.name + '.' + daoInfo.mapper + '] execution with params ';
        if (err) {
            logger.error(prefix, daoInfo.params, 'was failed: ', err, '\n');
        } else {
            //logger.info(prefix, daoInfo.params, 'result: ', result, '\n');
        }
    } else {
        logger.error(err, '\n');
    }
}

function _resultMappingForObject(resultMap, resultObj){
    if(!resultMap){
        return resultObj;
    } else {
        var ret = {};
        for(var column in resultObj){
            if(resultObj.hasOwnProperty(column)){
                var mappedName = ((resultMap[column]) ?
                    (_.isObject(resultMap[column]) ? resultMap[column].model : resultMap[column]) : column);
                ret[mappedName] = resultObj[column];
            }
        }
        return ret;
    }
}

function _resultMapping(resultMap, result){
    if(!resultMap){
        return result;
    } else {
        if(_.isArray(result)){
            var ret = [];
            for(var i=0; i<result.length; i++){
                ret.push(_resultMappingForObject(resultMap, result[i]));
            }
            return ret;
        } else if(_.isObject(result)) {
            return _resultMappingForObject(resultMap, result);
        } else {
            return result;
        }
    }
}

/**
 * execute a query with a variety of options
 *
 * @param context   database connection context including connection object, query info and result data
 *  - context.options
 *      - closeConnection   whether close current database connection after returning query result or not
 *      - useContextOnly    whether callback function called with no result set or not
 *      - result            'rows'(default) | 'row' | 'value'
 * @param callback  callback function that will be called after returning query result with db error and result set
 * @private
 */
function _execute(context, callback) {
    context.connection.query(context.daoInfo.query, context.daoInfo.params, function (err, result) {
        if(context.options.closeConnection) {
            context.connector.endConnection(context.connection);
        }
        if(!err && context.daoInfo.queryType === 'select' && result){
            context.result(result);
            if(context.options.result === 'row'){
                if(_.isArray(result) && result.length <= 1){
                    result = (result.length === 1) ? result[0] : null;
                } else {
                    return callback(new DBError(null, 'result should contain only a row', context));
                }
            } else if(context.options.result === 'value'){
                if(_.isArray(result) && result.length <= 1 && _.values(result[0]).length <= 1){
                    result = (_.values(result[0]).length === 1) ? _.values(result[0])[0] : null;
                } else {
                    return callback(new DBError(null, 'result should contain only a value', context));
                }
            }

            // default result mapping TODO result mapping with configuration
            result = _resultMapping(context.daoInfo.resultMap, result);

            /*if(_.isFunction(context.setData)){
                context.setData(result);
            }*/
        }
        context.result(result);

        if(_.isFunction(callback)){
            callback(err ? new DBError(err, null, context) : null, context);
           /* if(context.options.useContextOnly){
                callback(err ? new DBError(err) : null);
            } else {
                callback(err ? new DBError(err) : null, result);
            }*/
        }
        _logging(context.daoInfo, err, result);
    });
}

function _executeQuery(originalContext, callback){
    var context = originalContext;
    if(!originalContext){
        callback('Invalid context');
        _logging(null, 'Invalid context');
        return;
    }
    if(!(originalContext instanceof DBContext)) {
        context = new DBContext(originalContext.connector, originalContext.connection);
        context.set(originalContext);
    }
    context.holdRealStackTrace(_executeQuery);

    if(!context.connection) {
        context.connector.beginConnection(function (err, newConn) {
            if (err) {
                callback(new DBError(err, 'An error occurred while creating connection'));
                _logging(context.daoInfo, err);
            } else {
                context.connection = newConn;
                context.options.closeConnection = true;
                _execute(context, callback);
            }
        });
    } else {
        context.options.closeConnection = false;
        _execute(context, callback);
    }
}

function _getExecutable(originalContext){
    return function execute(context, callback) {
        context.set(originalContext);
        context.holdRealStackTrace(execute);

        //context = _.extend({}, originalContext, context);
        if(!context) {
            callback('Invalid context');
            _logging(null, 'Invalid context');
        } else if(!context.connection) {
            context.connector.beginConnection(function (err, newConn) {
                if (err) {
                    callback(new DBError(err, 'An error occurred while creating connection'));
                    _logging(originalContext.daoInfo, err);
                } else {
                    context.connection = newConn;
                    context.options.closeConnection = true;
                    //context.options.useContextOnly = false;
                    _execute(context, callback);
                }
            });
        } else {
            context.options.closeConnection = false;
            //context.options.useContextOnly = true;
            _execute(context, callback);
        }
    };
}

function _checkArguments(args) {
    var params = {}, context, callback;
    var length = args.length;
    for (var i = 0; i < length; i++) {
        if(_.isPlainObject(args[i])){
            params = args[i];
        } else if (_.isFunction(args[i])) {
            callback = args[i];
        } else {
            context = args[i];
        }
    }
    /*if (args.length > 0) {
        if()
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
    }*/
    return {params: params, context: context, callback: callback};
}

function _makeDaoMethod(dao, methodName, sql, options){
    var compile = compiler(sql);
    return function () {
        var args = _checkArguments(arguments);
        var context = args.context || {};
       /* if(!context){
            context = new DBContext();
        }*/
        var result = compile(args.params);  // TODO handler
        context.options = options || {};
        context.daoInfo = {
            name: dao._name,
            mapper: methodName,
            sql: sql,
            params: result.params,
            query: result.stmt,
            queryType: result.type,
            resultMap: (dao._defaultMap) ? dao._defaultMap.columns : undefined  // TODO custom result map
        };
        if (!context.connector) {
            context.connector = dao._connector;
        }
        return args.callback ? _executeQuery(context, args.callback) : _getExecutable(context);
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

var selectPattern = 'SELECT ~selectExpr~ FROM ~table~ ~whereClause~';
var updatePattern = 'UPDATE ~table~ ~setClause~ ~whereClause~';
var insertPattern = 'INSERT INTO ~table~ ( ~columnList~ ) VALUES ( ~valuesClause~ )';
var deletePattern = 'DELETE FROM ~table~ ~whereClause~';
var whereClausePattern = '{#where} ~conditions~ {/where}';
var setClausePattern = '{#set} ~assignments~ {/set}';
var columnListPattern = '{#trim (,)} ~columns~ {/trim}';
var valuesClausePattern = '{#trim (,)} ~values~ {/trim}';

/**
 * if this mapper has default map then it will generate some handy methods like belows...
 * $save, $findOne, $find, $update, $remove, $findAndModify(?), $count
 */
Mapper.prototype.addDefaultMethod = function(){
    var self = this;
    var result = {},
        table,
        conditions = '',
        assignments = '',
        columns = '',
        values = '';

    if(self._defaultMap){
        // SELECT * from {{table}} {#where} {#if columnA} AND column_a = {{columnA}} {/if} ... {/where}
        table = self._defaultMap.table;
        for(var colName in self._defaultMap.columns){
            if(self._defaultMap.columns.hasOwnProperty(colName)) {
                var col = self._defaultMap.columns[colName],
                    model = _.isObject(col) ? col.model : col;
                conditions += ' {#if ' + model + '} AND `' + colName + '` = {{' + model + '}} {/if} ';
                if (col.type === 'createTime') {
                    columns += ' `' + colName + '`, ';
                    values += ' now(), ';
                } else if (col.type === 'updateTime') {
                    assignments += ' `' + colName + '` = now() ';
                } else if (col.key) {
                    columns += ' `' + colName + '`, ';
                    values += ' {{ ' + model + ' }}, ';
                } else {
                    assignments += ' {#if $set.' + model + ' !== undefined} `' + colName + '` = {{ $set.' + model + ' }}, {/if} ';
                    columns += ' {#if ' + model + ' !== undefined} `' + colName + '`, {/if} ';
                    values += ' {#if ' + model + ' !== undefined} {{ ' + model + ' }}, {/if} ';
                }
            }
        }
        var whereClause = whereClausePattern.replace('~conditions~', conditions),
            setClause = setClausePattern.replace('~assignments~', assignments),
            columnList = columnListPattern.replace('~columns~', columns),
            valuesClause = valuesClausePattern.replace('~values~', values);
        var commonSelectQuery = selectPattern.replace('~table~', table).replace('~whereClause~', whereClause);
        var selectQuery = commonSelectQuery.replace('~selectExpr~', '*'),
            countQuery = commonSelectQuery.replace('~selectExpr~', 'COUNT(*)'),
            updateQuery = updatePattern.replace('~table~', table).replace('~setClause~', setClause)
                .replace('~whereClause~', whereClause),
            insertQuery = insertPattern.replace('~table~', table).replace('~columnList~', columnList)
                .replace('~valuesClause~', valuesClause),
            deleteQuery = deletePattern.replace('~table~', table).replace('~whereClause~', whereClause);

        self.$save = _makeDaoMethod(self, '$save', insertQuery);
        self.$findOne = _makeDaoMethod(self, '$findOne', selectQuery, {result: 'row'});
        self.$find = _makeDaoMethod(self, '$find', selectQuery);
        self.$update = _makeDaoMethod(self, '$update', updateQuery);
        self.$remove = _makeDaoMethod(self, '$remove', deleteQuery);
        self.$count = _makeDaoMethod(self, '$count', countQuery, {result: 'value'});
    }
    //self.$save = _makeDaoMethod(self, '$save', queryUtil.generate('save', self._defaultMap));
    return result;
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
            self._defaultMap = (self._maps) ? self._maps.default : undefined;
            self._queries = self.configuration.queries;
            self.addDefaultMethod();
            self.makeMappers();
            self._fileLoaded = true;
        } catch (e) {
            if(e.code === 'ENOENT'){
                logger.error(self.name + ' mapper configuration file not found: ' + file);
            } else if (e instanceof SyntaxError) {
                logger.error(self.name + ' mapper configuration has a parsing error: ' + file, e);
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