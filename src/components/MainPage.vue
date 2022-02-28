<template>
  <h1>这是第{{ database.last }}页</h1>
  <div v-if="database.movies">
    <div v-if="database.movies[current]">
      <MovieCard
        :id="database.movies[current].id"
        :title="database.movies[current].title"
        :imgurl="
          'https://images.weserv.nl/?url=' + database.movies[current].imageurl
        "
      />
    </div>
  </div>
  <div v-if="database.movies">
    <a-pagination
      v-model:current="current"
      show-quick-jumper
      :total="(database.movies.length - 1) * 10"
      @change="onChange"
    />
    <br />
  </div>
</template>
<script>
import axios from "axios";
import { defineComponent, ref } from "vue";
import MovieCard from "./MovieCard";
export default defineComponent({
  setup() {
    const current = ref(1);

    const onChange = (pageNumber) => {
      console.log("Page: ", pageNumber);
    };

    return {
      current,
      onChange,
    };
  },
  data() {
    return {
      database: [],
    };
  },
  mounted() {
    axios
      .get("https://raw.githubusercontent.com/typenoob/iolix/master/db.json")
      .then((response) => {
        this.database = response.data.database;
      })
      .catch(function (error) {
        console.log(error);
      });
  },
  components: {
    MovieCard,
  },
  methods: {
    findLabel: function (id) {
      console.log(this.database.movies);
      for (var movie of this.database.movies) {
        if (id == movie.id) {
          return movie;
        }
      }
    },
  },
});
</script>