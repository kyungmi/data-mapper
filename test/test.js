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
            userDao.addUser({id: 0, name: 'username', phone: '111-222-3333', isAdmin: 1}, function (err, result) {
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
        var updateUser = {id:userId, name: 'updatedUser', phone: 'updatephone', isAdmin: 0};
        var transaction = new Transaction([
            //userDao.deleteAllUser(),
            userDao.getUsers(),
            function(context, next){
                if(!_.isEmpty(context.getData(0))){
                    var maxUser = _.max(context.getData(0), function(user){
                        return user.userId;
                    });
                    userId = maxUser.userId + 1;
                    updateUser.id = userId;
                }
                userDao.addUser({id:userId, name:'newUser', phone: '12342321321312', isAdmin: 1}, function(err){
                    context.setData(userId);
                    next(err);
                }, context);
            },
            function(context, next) {
                userDao.modifyUser(updateUser, function(err/*, result*/){
                    next(err);
                }, context);
            }
        ]);
        it('user', function(done){
            transaction.start(function (err, context) {
                if (!err) {
                    userDao.getUserById({id: context.getData(1)}, function (err, result) {
                        assert.equal(result.length, 1);
                        assert.equal(result[0].userId, updateUser.id);
                        assert.equal(result[0].userName, updateUser.name);
                        assert.equal(result[0].userPhone, updateUser.phone);
                        assert.equal(result[0].isAdmin, updateUser.isAdmin);
                        done(err);
                    });
                }
            });
        });
    });
    describe('use default method', function () {
        it('$find', function(done){
           userDao.$find({userId: 1}, function(err, result){
               assert.equal(result instanceof Array, true);
               assert.equal(result[0].userId, 1);
               done(err);
           });
        });
        it('$findOne', function(done){
            userDao.$findOne({userId: 1}, function(err, result){
                assert.equal(result instanceof Object, true);
                assert.equal(result.userId, 1);
                done(err);
            });
        });
        it('$count', function(done){
            userDao.$count({userId: 1}, function(err, result){
                assert.equal(typeof result, 'number');
                assert.equal(result, 1);
                done(err);
            });
        });
        it('$remove', function(done){
           userDao.$remove({userId: 1}, function(err, result){
               assert.equal(result.affectedRows, 1);
               done(err);
           });
        });
        it('$save', function(done){
            userDao.$save({userId: 1, userName: 'username1', userPhone: '111-222-3333', isAdmin: 1}, function(err, result){
                if(err){
                    done(err);
                } else {
                    assert.equal(result.affectedRows, 1);
                    userDao.$findOne({userId: 1}, function (err, result) {
                        assert.equal(result.userId, 1);
                        assert.equal(result.userName, 'username1');
                        assert.equal(result.userPhone, '111-222-3333');
                        assert.equal(result.isAdmin, 1);
                        done(err);
                    });
                }
            });
        });
        it('$update', function(done){
            userDao.$update({userId: 1, $set: {userName: 'username1-up', userPhone: '111-222-4444', isAdmin: 0}}, function(err, result){
                if(err){
                    done(err);
                } else {
                    assert.equal(result.affectedRows, 1);
                    userDao.$findOne({userId: 1}, function (err, result) {
                        assert.equal(result.userId, 1);
                        assert.equal(result.userName, 'username1-up');
                        assert.equal(result.userPhone, '111-222-4444');
                        assert.equal(result.isAdmin, 0);
                        done(err);
                    });
                }
            });
        });
    });
    describe('foreach', function() {
        it('foreach', function(done){
            userDao.getUserByIds({list:[1,2,3,4]}, function(err, result){
                if(!err) {
                    assert.equal(result.length <= 4, true);
                    for (var i = 0; i < result.length; i++) {
                        assert.equal([1, 2, 3, 4].indexOf(result[i].userId) > -1, true);
                    }
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