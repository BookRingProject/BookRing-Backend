const validateProfileUpdate = (data, role) => {
  const errors = {};

  if (data.name !== undefined && data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (data.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.email = 'Please provide a valid email address';
    }
  }

  if (role === 'lecturer') {
    if (data.specialty !== undefined && data.specialty.trim() === '') {
      errors.specialty = 'Specialty cannot be empty';
    }
    if (data.institution !== undefined && data.institution.trim() === '') {
      errors.institution = 'Institution cannot be empty';
    }
    if (data.phone !== undefined && data.phone.trim() !== '') {
      const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
      if (!phoneRegex.test(data.phone)) {
        errors.phone = 'Please provide a valid phone number';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  validateProfileUpdate,
};