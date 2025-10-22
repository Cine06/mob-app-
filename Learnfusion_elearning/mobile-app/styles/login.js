import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#046a38",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  tagline: {
    color: "#FFD700",
    fontSize: 14,
    marginBottom: 30,
  },
  loginTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "90%",
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 25,
    marginBottom: 15,
  },
  passwordContainer: {
    width: "90%",
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 25,
    marginBottom: 15,
    paddingLeft: 15,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 0,
  },
  loginButton: {
    backgroundColor: "#FFC72C",
    paddingVertical: 15,
    width: "50%",
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 60,
  },
  loginButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },

});
