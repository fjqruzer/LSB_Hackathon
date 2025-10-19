// validation.js
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters long';
  if (password.length > 128) return 'Password must be less than 128 characters';
  
  // Check for at least one uppercase letter, one lowercase letter, and one number
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  
  return null;
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

export const validateName = (name, fieldName) => {
  if (!name) return `${fieldName} is required`;
  if (name.length < 2) return `${fieldName} must be at least 2 characters long`;
  if (name.length > 50) return `${fieldName} must be less than 50 characters`;
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(name)) return `${fieldName} contains invalid characters`;
  
  return null;
};

export const validateLocation = (value, fieldName) => {
  if (!value) return `Please select a ${fieldName}`;
  return null;
};

export const validateRegistrationForm = (formData) => {
  const errors = {};

  // Step 1 validation
  const firstNameError = validateName(formData.firstName, 'First name');
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateName(formData.lastName, 'Last name');
  if (lastNameError) errors.lastName = lastNameError;

  // Middle name is optional, but if provided, validate it
  if (formData.middleName && formData.middleName.trim()) {
    const middleNameError = validateName(formData.middleName, 'Middle name');
    if (middleNameError) errors.middleName = middleNameError;
  }

  const emailError = validateEmail(formData.email);
  if (emailError) errors.email = emailError;

  // Step 2 validation
  const regionError = validateLocation(formData.region, 'region');
  if (regionError) errors.region = regionError;

  const provinceError = validateLocation(formData.province, 'province');
  if (provinceError) errors.province = provinceError;

  const cityError = validateLocation(formData.city, 'city');
  if (cityError) errors.city = cityError;

  const barangayError = validateLocation(formData.barangay, 'barangay');
  if (barangayError) errors.barangay = barangayError;

  // Step 3 validation
  const passwordError = validatePassword(formData.password);
  if (passwordError) errors.password = passwordError;

  const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
  if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const getStepValidation = (step, formData) => {
  const errors = {};

  switch (step) {
    case 1:
      const firstNameError = validateName(formData.firstName, 'First name');
      if (firstNameError) errors.firstName = firstNameError;

      const lastNameError = validateName(formData.lastName, 'Last name');
      if (lastNameError) errors.lastName = lastNameError;

      if (formData.middleName && formData.middleName.trim()) {
        const middleNameError = validateName(formData.middleName, 'Middle name');
        if (middleNameError) errors.middleName = middleNameError;
      }

      const emailError = validateEmail(formData.email);
      if (emailError) errors.email = emailError;
      break;

    case 2:
      const regionError = validateLocation(formData.region, 'region');
      if (regionError) errors.region = regionError;

      const provinceError = validateLocation(formData.province, 'province');
      if (provinceError) errors.province = provinceError;

      const cityError = validateLocation(formData.city, 'city');
      if (cityError) errors.city = cityError;

      const barangayError = validateLocation(formData.barangay, 'barangay');
      if (barangayError) errors.barangay = barangayError;
      break;

    case 3:
      const passwordError = validatePassword(formData.password);
      if (passwordError) errors.password = passwordError;

      const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
      if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
