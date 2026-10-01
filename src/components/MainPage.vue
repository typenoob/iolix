<template>
  <VanSearch :class="{ focus: isSearching }" v-model="searchValue" show-action @focus="onFocus" @blur="onBlur"
    @search="onSubmit" @cancel="onCancel" />
  <Transition name="fade" mode="out-in">
    <div v-if="isSearching">
      <p v-if="searchLoading">搜索中...</p>
      <template v-else>
        <SearchResult :movies="searchMovies" />
        <p v-if="searchTotal > searchMovies.length">共匹配 {{ searchTotal }} 条，仅显示前 {{ searchMovies.length }} 条</p>
        <p v-else-if="searchTotal === 0 && searchValue">没有匹配的影片</p>
        <p v-else-if="!searchValue">输入关键词开始搜索</p>
      </template>
    </div>
    <div class="container" v-else>
      <h1>这是第{{ current }}页</h1>
      <p v-if="loading">加载中...</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <template v-else>
        <div v-if="movies.length" class="flex-container">
          <MovieCard class="flex-item" v-for="movie in movies" :key="movie.id" :id="movie.id" :title="movie.title"
            :imgurl="movie.imageurl" />
        </div>
        <p v-else>暂无数据</p>
      </template>
      <div v-if="total">
        <a-pagination v-model:current="current" show-quick-jumper :pageSize="pageSize" :total="total"
          @change="onChange" />
        <br />
      </div>
    </div>
  </Transition>
</template>
<script>
import { defineComponent } from "vue";
import MovieCard from "./MovieCard";
import SearchResult from "./SearchResult.vue";
import { getMovies, searchMovies, getMeta } from "../api";

export default defineComponent({
  components: { MovieCard, SearchResult },
  data() {
    return {
      movies: [],
      total: 0,
      current: 1,
      pageSize: 8,
      loading: false,
      error: "",
      isSearching: false,
      searchValue: "",
      searchResult: { total: 0, items: [] },
      searchLoading: false,
      searchTimer: null,
    };
  },
  computed: {
    searchMovies() {
      return this.searchResult.items;
    },
    searchTotal() {
      return this.searchResult.total;
    },
  },
  watch: {
    current() {
      this.loadMovies();
    },
    searchValue(value) {
      clearTimeout(this.searchTimer);
      if (!value.trim()) {
        this.searchResult = { total: 0, items: [] };
        this.searchLoading = false;
        return;
      }
      // 输入发生变化就先进入加载态，避免短暂显示上一次结果或“没有匹配的影片”
      this.searchLoading = true;
      this.searchTimer = setTimeout(() => this.runSearch(value), 300);
    },
  },
  async mounted() {
    await this.loadMeta();
    this.loadMovies();
  },
  methods: {
    // 分页总数统一取 /api/meta：列表按页独立缓存，不同页可能拿到不同时刻的旧快照，
    // 直接用列表响应的 total 会出现「首页 40 页、翻页后 58 页」的页数跳动
    async loadMeta() {
      try {
        const meta = await getMeta();
        this.total = meta?.total ?? 0;
      } catch {
        this.total = 0; // 交给 loadMovies 兜底
      }
    },
    onFocus() {
      this.isSearching = true;
    },
    // 回车会让输入框失焦，但只要还有关键词就保持搜索态，避免跳回分页列表
    onBlur() {
      if (!this.searchValue.trim()) this.isSearching = false;
    },
    onSubmit() {
      clearTimeout(this.searchTimer);
      if (!this.searchValue.trim()) return;
      this.isSearching = true;
      this.runSearch(this.searchValue);
    },
    onCancel() {
      clearTimeout(this.searchTimer);
      this.searchValue = "";
      this.searchResult = { total: 0, items: [] };
      this.searchLoading = false;
      this.isSearching = false;
    },
    async loadMovies() {
      this.loading = true;
      this.error = "";
      try {
        const data = await getMovies(this.current, this.pageSize);
        this.movies = data.items ?? [];
        // 仅在 meta 不可用时兜底，避免翻页过程中被列表响应改写 total
        if (!this.total) this.total = data.total ?? 0;
      } catch (e) {
        this.error = "加载失败，请稍后重试";
        this.movies = [];
      } finally {
        this.loading = false;
      }
    },
    async runSearch(keyword) {
      this.searchLoading = true;
      try {
        this.searchResult = await searchMovies(keyword.trim(), 8);
      } catch (e) {
        this.searchResult = { total: 0, items: [] };
      } finally {
        this.searchLoading = false;
      }
    },
    onChange(pageNumber) {
      this.current = pageNumber;
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

.error {
  color: #c0392b;
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
