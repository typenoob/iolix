<template>
    <div>
        <div class="container">
            <h1>搜索结果</h1>
            <div class="flex-container">
                <MovieCard class="flex-item" v-for="movie in movies" :key="movie.id" :id="movie.id" :title="movie.title"
                    :imgurl="movie.imageurl" />
            </div>
        </div>
    </div>
</template>
<script>
import MovieCard from './MovieCard.vue';
export default {
    name: "SearchResult",
    components: {
        MovieCard,
    },
    props: {
        movies: Array,
    },
}
</script>
<style scoped>
.container {
    background-color: antiquewhite;
}

.flex-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: left;
}

.flex-item {
    margin: 10px;
}
</style>