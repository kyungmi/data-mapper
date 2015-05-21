'use strict';

function DBException(error, msg){
    this.code = 'DB' + error.errno;
    this.originalError = error;
    this.msg = msg;
    //console.error('DB ERROR!', this);
}

module.exports = DBException;