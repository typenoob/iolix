<template>
  <VanSearch :class="{ focus: isSearching }" ref="searchbar" v-model="searchValue" @focus="isSearching = true"
    @blur="isSearching = false" />
  <Transition name="fade" mode="out-in">
    <div v-if="isSearching">
      <SearchResult :movies="searchMovies" />
    </div>
    <div class="container" v-else>
      <h1>这是第{{ current }}页</h1>
      <div v-if="database.movies">
        <div v-if="database.movies[current]" class="flex-container">
          <MovieCard class="flex-item" :key="movies.id"
            v-for="movies in database.movies.slice((current - 1) * 8, current * 8)" :id="movies.id" :title="movies.title"
            :imgurl="movies.imageurl" />
        </div>
      </div>
      <div v-if="database.movies">
        <a-pagination v-model:current="current" show-quick-jumper :pageSize="8" :total="database.movies.length"
          @change="onChange" />
        <br />
      </div>
    </div>
  </Transition>
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
      // limit up to 8 results
      return this.database.movies?.filter(movie => movie.title.includes(this.searchValue)).slice(0, 8);
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
<style scoped>
.flex-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: left;
}

.flex-item {
  margin: 10px;
}

.focus {
  border: 0.5px solid #292a2b;
  border-radius: 8px;
}

.container {
  background-color: lightsteelblue;
}

.van-cell {
  border: none !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .5s
}

.fade-enter,
.fade-leave-to {
  opacity: 0
}
</style>