"use strict";
function isJsonString(str) {
    try {
        if (typeof JSON.parse(str) == "object") return true;
        else return false;
    } catch (e) {
        return false;
    }
}
class movie {
    constructor(id, title, imageurl, url) {
        this.id = id;
        this.title = title;
        this.imageurl = imageurl;
        this.url = url;
    }
}
const fs = require('fs');
// 存入数据
const set = function (key, value) {
    fs.readFile('./db.json', (err, data) => {
        const json = data.toString() ? JSON.parse(data) : {};
        json[key] = value;
        // 写入文件
        fs.writeFile('./db.json', JSON.stringify(json, "", "\t"), err => {
            if (err) {
                console.log(err)
            } else
                console.log('update Success!');
        })
    })
}
const movieinfo_1 = require('./api/movieinfo');
if (!fs.existsSync('./db.json')) fs.writeFileSync('./db.json', JSON.stringify({ database: { last: undefined, movies: [] } }));
const data = fs.readFileSync('./db.json', 'utf-8');
var database = { last: undefined, movies: [] };
if (isJsonString(data)) database = JSON.parse(data)['database'];
function getTasks(start, end) {
    var tasks = [];
    for (var i = start; i <= end; i++) {
        if (!database.movies.map(item => { return item.id; }).includes(i)) {
            tasks.push(movieinfo_1.getMovieData(i, -1).then(res => {
                if (res && res.code == 0) {
                    database.movies.push(new movie(res.object.id, res.object.title, res.object.imageurl, "http://fx.meiying.cool/#/home/" + res.object.id + "/-1"));
                    database.last = Math.max(database.last, res.object.id);
                }
            }));
        }
        else {
            database.last = Math.max(database.last, i);
        }
    }
    return tasks;
}
const init = 1, step = 100, finish = 6900;//database.last ? database.last + 2 * step : 6900;
function doJob(start, end) {
    console.log('正在更新第', start, '至', end, '条记录，请稍后...');
    var ret = getTasks(start, end);
    ret.push(start);
    ret.push(end);
    return Promise.all(ret);
}
var all = [];
function recursion(start, end) {
    if (end <= finish) {
        all.push(
            doJob(start, end).then(
                (items) => { recursion(items[items.length - 2] + 100, items[items.length - 1] + 100) }
            ));
    }
    else Promise.all(all).then(() => { set('database', database) });
}
recursion(init, init + step - 1);
