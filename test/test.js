/**
 * Created by kyungmi.koong on 2015-04-25.
 */

'use strict';

var assert  = require('assert');
var dataMapperConf = require('./conf/data-mapper-conf.json');
var dataMapper = require('./../lib/data-mapper').init(dataMapperConf);
var _ = require('lodash');
var userDao = dataMapper.dao('user');
var Transaction = dataMapper.Transaction;

describe('Use useDao', function () {
    describe('add and delete user', function () {
        it('add user', function (done) {
            userDao.addUser({id: 0, name: 'username', phone: '111-222-3333'}, function (err, result) {
                if (!err) {
                    assert.equal(result.affectedRows, 1);
                    assert.equal(result.insertId, 0);
                }
                done(err);
            });
        });
        it('delete user', function (done) {
            userDao.deleteUserById({id: 0}, function (err, result) {
                if (!err) {
                    assert.equal(result.affectedRows, 1);
                }
                done(err);
            });
        });
    });

    describe('use transaction', function () {
        var userId = 1;
        var updateUser = {id:userId, name: 'updatedUser', phone: 'updatephone'};
        var transaction = new Transaction([
            //userDao.deleteAllUser(),
            userDao.getUsers(),
            function(connection, result, next){
                if(!_.isEmpty(result)){
                    var maxUser = _.max(result, function(user){
                        return user.id;
                    });
                    userId = maxUser.id + 1;
                }
                userDao.addUser({id:userId, name:'newUser', phone: '12342321321312'}, connection, function(err, result){
                    next(err, connection, userId);
                });
            },
            function(connection, userId, next) {
                userDao.modifyUser(updateUser, connection, function(err, result){
                    next(err, connection, userId);
                });
            }
        ]);
        it('user', function(done){
            transaction.start(function (err, userId) {
                if (!err) {
                    userDao.getUserById({id: userId}, function (err, result) {
                        assert.equal(result.length, 0);
                        assert.deepEqual(result[0], updateUser);
                    });
                }
                done(err);
            });
        });
    });
});

//userDao.addUser({id: 0, name: 'username', phone: '111-222-3333'}, function(err, result){
//    if(err){
//        console.log('failed to add a user', err);
//    } else {
//        console.log('add successfully', result);
//        userDao.deleteUserById({id: 0}, function (err, result) {
//            if (err) {
//                console.log('failed to delete a user', err);
//            } else {
//                console.log('delete successfully', result);
//            }
//        });
//    }
//});

//var transaction = new Transaction([
//    //userDao.deleteAllUser(),
//    userDao.getUsers(),
//    function(connection, result, next){
//        var userId = 1;
//        if(!_.isEmpty(result)){
//            var maxUser = _.max(result, function(user){
//                return user.id;
//            });
//            userId = maxUser.id + 1;
//        }
//        userDao.addUser({id:userId, name:'newUser', phone: '12342321321312'}, connection, function(err, result){
//            next(err, connection, userId);
//        });
//    },
//    function(connection, userId, next) {
//        userDao.modifyUser({id:userId, name: 'updatedUser', phone: 'updatephone'}, connection, function(err, result){
//            next(err, connection, userId);
//        });
//    }
//]);
//transaction.start(function (err, userId) {
//    if (!err) {
//        userDao.getUserById({id: userId}, function (err, result) {
//            console.log('RESULT: ', result);
//        });
//    } else {
//        console.error(err);
//    }
//});