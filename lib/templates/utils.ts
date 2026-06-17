export function validateName(value: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
    return "Please enter a valid name in kebab-case (lowercase letters, numbers, and hyphens only)";
  }
  if (value.endsWith("-plugin")) {
    return "Please do not end the name with '-plugin'";
  }
  return true;
}

export function validatePluginName(value: string) {
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
    return "Please enter a valid plugin name in PascalCase (start with an uppercase letter and contain only letters and numbers)";
  }
  return true;
}

export function generateDefaultPluginName(name: string, location: string) {
  return (
    name
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") +
    location.charAt(0).toUpperCase() +
    location.slice(1) +
    "Plugin"
  );
}
