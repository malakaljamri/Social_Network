<template>
  <div class="post-card">
    <h2>{{ post.title }}</h2>
    <p>{{ post.content }}</p>
    <div class="post-footer">
      <button @click="likePost(post.id)">Like ({{ post.likes }})</button>
      <button @click="dislikePost(post.id)">Dislike ({{ post.dislikes }})</button>
    </div>
  </div>
</template>

<script>
export default {
  props: ['post'],
  methods: {
    likePost(postId) {
      // Like logic
    },
    dislikePost(postId) {
      // Dislike logic
    },
  },
};
</script>
