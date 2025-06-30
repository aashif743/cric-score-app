import React, { useState } from 'react';

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const { name, email, password } = formData;

  const onChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // We will add registration logic here later
    console.log(formData);
  };

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <input
          type="text"
          name="name"
          value={name}
          placeholder="Enter your name"
          onChange={onChange}
        />
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

export default Register;