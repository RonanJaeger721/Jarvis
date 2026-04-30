import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    plugins: {
      'firebase-security-rules': firebaseRulesPlugin
    }
  },
  firebaseRulesPlugin.configs['flat/recommended']
]
