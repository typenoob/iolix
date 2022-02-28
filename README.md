# iolix

## 简介

通过nodejs，爬取某网站的电影信息，提供标题、播放链接等信息。

## Project setup
```
npm install
```

### 更新电影数据库
```
npm run update
```

#### 字段说明

| database.last            | database.movies.id | database.movies.titile | database.movies.imageurl   | database.movies.url |
| ------------------------ | ------------------ | ---------------------- | -------------------------- | ------------------- |
| 爬取到的最后一部电影编号 | 电影编号       | 电影标题           | 电影海报图片（来源：豆瓣） | 可播放的电影链接 |

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## github自动流程

已通过github每一个小时自动执行更新命令，数据存储在 [电影数据库](https://raw.githubusercontent.com/typenoob/iolix/master/db.json)

## github page

已通过github部署了[静态网页](http://blog.coyote.gq/iolix)

## TODO

改进网页
