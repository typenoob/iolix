<template>
  <MovieCard
    id="666"
    title="title"
    imgurl="https://images.weserv.nl/?url=https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2848324437.webp"
  />
</template>

<script>
import MovieCard from "./components/MovieCard";
export default {
  name: "App",
  components: { MovieCard },
  data() {
    return {
      show: function () {
        var movieinfo = require("./api/movieinfo");
        movieinfo.getMovieData(300, -1).then((res) => {
          localStorage["res"] = res;
        });
      },
    };
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
