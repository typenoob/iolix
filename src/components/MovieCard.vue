<template>
  <a :href="'http://fx.meiying.cool/#/home/' + id + '/-1'">
    <a-card :title="title" style="width: 300px;background-color: lightgray;">
      <p>
        {{ title }}
        <a-image :src="imgurl" />
      </p>
    </a-card>
    <br />
  </a>
</template>
<script>
export default {
  name: "MovieCard",
  props: {
    id: Number,
    title: String,
    imgurl: String,
  },
};
</script>
