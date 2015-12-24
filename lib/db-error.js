'use strict';

var util = require('util');

function _generateFullMsg(error, msg, context) {
    var message = '[DB' + ((error && error.errno) ? error.errno : '0000') + '] ';
    if (context && context.daoInfo) {
        message += 'Query [' + context.daoInfo.name + '.' + context.daoInfo.mapper + '] execution ';
        if (context.daoInfo.params) {
            message += ' with params ' + JSON.stringify(context.daoInfo.params);
        }
        message += ' was failed: ';
    }
    if (msg) {
        message += (msg + ': ');
    }
    if (typeof error === 'string') {
        message += ('\n\tcaused by ' + error);
    } else if (error instanceof Error) {
        message += ('\n\tcaused by ' + error.message);
    }
    if (context && context.result()) {
        message += ('\n\t' + JSON.stringify({result: context.result()}));
    }
    return message;
}

function DBError(error, msg, context) {
    Error.call(this);
    this.name = this.constructor.name;
    this.causedBy = error;
    this.message = _generateFullMsg(error, msg, context);
    Error.captureStackTrace(this, this.constructor);
    if (context) {
        if (context.traceHolder.stack) {
            var stack = context.traceHolder.stack;
            stack = stack.replace('[object Object]', this.message);
            this.stack = stack;
        }
    }
}
util.inherits(DBError, Error);

module.exports = DBError;
