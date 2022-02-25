"use strict";
var axios_1 = require("axios");
var vant_1 = require("vant");
var CryptoJS = require('crypto-js');
function request(config) {
    // 1.创建axios的实例
    var instance = axios_1["default"].create({
        baseURL: "http://fx.meiying.cool/api/",
        timeout: 8000
    });
    // 2.axios的拦截器
    // 2.1.请求拦截的作用
    instance.interceptors.request.use(function (config) {
        var timestamp = new Date().getTime();
        var platform = 'iOS';
        var aesKey = timestamp + platform;
        var headers = {
            'x-mflix-ts': timestamp,
            'x-mflix-deviceId': platform,
            'x-mflix-platform': platform,
            'Content-Type': 'application/plain'
        };
        config.headers = headers;
        function encrypt(word, keyStr) {
            var key = CryptoJS.enc.Utf8.parse(keyStr);
            var srcs = CryptoJS.enc.Utf8.parse(JSON.stringify(word));
            var encrypted = CryptoJS.AES.encrypt(srcs, key, { iv: key, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
            return encrypted.toString();
        }
        var aesData = encrypt(config.params, aesKey);
        config.data = aesData;
        return config;
    }, function (err) {
        console.log(err);
    });
    vant_1.Toast.loading({
        message: "加载中...",
        forbidClick: true,
        loadingType: "spinner"
    });
    // 2.2.响应拦截
    instance.interceptors.response.use(function (res) {
        vant_1.Toast.clear();
        var text = res.data;
        var aesKey = text.slice(-16);
        var aesWord = text.slice(0, text.length - 16);
        var jsonData = decrypt(aesWord, aesKey);
        function decrypt(word, keyStr) {
            var key = CryptoJS.enc.Utf8.parse(keyStr);
            var iv = CryptoJS.enc.Utf8.parse(keyStr);
            var decrypt = CryptoJS.AES.decrypt(word, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
            var decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
            return decryptedStr.toString();
        }
        return JSON.parse(jsonData);
    }, function (err) {
        console.log(err);
    });
    // 3.发送真正的网络请求
    return instance(config);
}
module.exports.request = request;
