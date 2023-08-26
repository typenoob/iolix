<template>
    <div class="container">
        <div class="row">
            <div class="col-md-12">
                <h1>搜索结果</h1>
                <div class="row">
                    <div class="col-md-12">
                        <div class="row">
                            <MovieCard v-for="movie in movies" :key="movie.id" :id="movie.id" :title="movie.title"
                                :imgurl="movie.imgurl" />
                        </div>
                    </div>
                </div>
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