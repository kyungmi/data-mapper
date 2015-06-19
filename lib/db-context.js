/**
 * Created by kyungmi.koong on 2015-06-19.
 */

'use strict';

function DBContext(connector, connection) {
    var _result = null,
        _data = {};
    this.connector = connector;
    this.connection = connection;
    this.options = {};
    this.daoInfo = {};
    this.traceHolder = {};

    this.result = function(/* [0]result */) {
        if (arguments.length === 0) {
            return _result;
        } else if (arguments.length === 1) {
            _result = arguments[0];
        }
    };
    this.data = function(/* [0]key, [1]data */) {
        if (arguments.length === 1) {
            return _data[arguments[0]];
        } else if (arguments.length === 2){
            _data[arguments[0]] = arguments[1];
        }
    };
}

DBContext.prototype.result = function() {
    return this.result.apply(this, arguments);
};

DBContext.prototype.data = function() {
    return this.data.apply(this, arguments);
};

DBContext.prototype.holdRealStackTrace = function(callee) {
    var holder = {};
    Error.captureStackTrace(holder, callee);
    this.traceHolder = holder;
};

DBContext.prototype.getRealStackTrace = function() {
    return this.traceHolder.stack;
};

module.exports = DBContext;