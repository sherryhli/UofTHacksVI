import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    userId: 1,
    userName: 'Sherry',
    booksBuy: [],
    booksSell: [],
    loggedIn: false,
  },
  mutations: {
    pushBooksBuy (state, payload) {
      // console.log(payload);
      state.booksBuy.push(payload.bookBuy);
    },
    pushBooksSell (state, payload) {
      console.log(payload.bookSell);
      state.booksSell.push(payload.bookSell);
      console.log(state);
    },
    login (state, payload) {
      state.loggedIn = payload.value;
    },
  },
  actions: {

  },
});
