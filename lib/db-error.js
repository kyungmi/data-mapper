'use strict';

function DBException(error, msg, result){
    this.code = (error && error.errno) ? ('DB' + error.errno) : 'DB0000';
    this.originalError = error;
    this.msg = msg;
    this.result = result;
    //console.error('DB ERROR!', this);
}

module.exports = DBException;