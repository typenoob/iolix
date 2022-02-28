<template>
  <h1>这是第{{ database.last }}页</h1>
  <div>
    <a-pagination
      v-model:current="current1"
      show-quick-jumper
      :total="500"
      @change="onChange"
    />
    <br />
  </div>
</template>
<script>
import axios from "axios";
import { defineComponent, ref } from "vue";
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
      database: "ceshi",
    };
  },
  mounted() {
    console.log(1);
    axios
      .get("https://raw.githubusercontent.com/typenoob/iolix/master/db.json")
      .then((response) => {
        this.database = response.data.database;
      })
      .catch(function (error) {
        console.log(error);
      });
  },
});
</script>