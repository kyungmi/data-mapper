'use strict';

var util = require('util');

function DBError(error, msg, context) {
    this.name = 'DBError';
    this.code = (error && error.errno) ? ('DB' + error.errno) : 'DB0000';
    this.originalError = error;
    this.message = msg;
    Error.captureStackTrace(this, DBError);
    if(context){
        this.detail = context.result();
        if(context.traceHolder.stack){
            console.error('context.traceHolder.stack: ', context.traceHolder.stack);
            console.error('this.stack: ', this.stack);
            this.stack = context.traceHolder.stack;
        } else {

        }
    }
}
util.inherits(DBError, Error);

module.exports = DBError;