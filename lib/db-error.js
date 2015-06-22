'use strict';

var util = require('util');

function DBError(error, msg, context) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = (msg ? msg + ': ' : '') + (error ? error.message : '');
    this.code = (error && error.errno) ? ('DB' + error.errno) : 'DB0000';
    this.originalError = error;
    if (context) {
        this.detail = context.result();
        if (context.traceHolder.stack) {
            this.stack = context.traceHolder.stack;
        }
    }
}
util.inherits(DBError, Error);

module.exports = DBError;