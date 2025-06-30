import React, { useState } from 'react';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const { email, password } = formData;

  const onChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // We will add login logic here later
    console.log(formData);
  };

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          name="email"
          value={email}
          placeholder="Enter your email"
          onChange={onChange}
        />
        <input
          type="password"
          name="password"
          value={password}
          placeholder="Enter your password"
          onChange={onChange}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default Login;