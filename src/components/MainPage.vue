<template>
  <VanSearch ref="searchbar" v-model="searchValue" @focus="isSearching = true" @blur="isSearching = false" />
  <SearchResult v-if="isSearching" :movies="searchMovies" />
  <template v-else>
    <h1>这是第{{ database.last }}页</h1>
    <div v-if="database.movies">
      <div v-if="database.movies[current]">
        <MovieCard :id="database.movies[current].id" :title="database.movies[current].title"
          :imgurl="database.movies[current].imageurl" />
      </div>
    </div>
    <div v-if="database.movies">
      <a-pagination v-model:current="current" show-quick-jumper :total="(database.movies.length - 1) * 10"
        @change="onChange" />
      <br />
    </div>
  </template>
</template>
<script>
import axios from "axios";
import { defineComponent, ref } from "vue";
import MovieCard from "./MovieCard";
import SearchResult from "./SearchResult.vue";
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
      isSearching: false,
      searchValue: "",
    };
  },
  computed: {
    searchMovies() {
      // limit up to 5 results
      return this.database.movies?.filter(movie => movie.title.includes(this.searchValue)).slice(0, 5);
    }
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
    MovieCard, SearchResult
  },
  methods: {
    findLabel: function (id) {
      for (var movie of this.database.movies) {
        if (id == movie.id) {
          return movie;
        }
      }
    },
  },
});
</script>