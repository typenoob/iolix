<template>
  <a :href="url">
    <a-card :title="title" style="width: 300px">
      <p>
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
  computed: {
    url: {
      // getter
      get() {
        return "http://fx.meiying.cool/#/home/" + this.id + "/-1";
      },
      // setter
    },
  },
};
</script>
