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
        fs.writeFile('./db.json', JSON.stringify(json), err => {
            if (err) {
                console.log(err)
            }
            console.log('update Success!');
        })
    })
}
const movieinfo_1 = require('./api/movieinfo');
var count = 0;
const data = fs.readFileSync('./db.json', 'utf-8');
var database = { last: undefined, movies: [] };
if (isJsonString(data)) database = JSON.parse(data)['database'];
const increasement = 30;
for (var i = database.last ? database.last : 1; i <= (database.last ? database.last : 1) + increasement; i++) {
    movieinfo_1.getMovieData(i, -1).then(res => {
        if (res && res.code == 0) {
            count += 1;
            database.movies.push(new movie(res.object.id, res.object.title, res.object.imageurl, "http://fx.meiying.cool/#/home/" + this.id + "/-1"));
            database.last = i;
            if (count == increasement) {
                set('database', database);
            }
        }
        else {
            count += 1;
            if (count == increasement) {
                set('database', database);
            }
        }
    })
}

