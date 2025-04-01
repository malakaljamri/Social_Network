<template>
  <nav>
    <div class="nav-links">
      <span v-if="user.isLoggedIn">{{ user.username }}</span>
      <button v-if="user.isLoggedIn" @click="logout">Logout</button>
      <button v-else @click="showLogin">Login</button>
    </div>
  </nav>
</template>

<script>
export default {
  data() {
    return {
      user: {
        isLoggedIn: false,
        username: '',
      },
    };
  },
  methods: {
    logout() {
      // Logout logic
    },
    showLogin() {
      // Show login modal
    },
  },
};
</script>
