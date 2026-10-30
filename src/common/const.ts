export const PasswordPattern = [
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/,
    "Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial",
];

export const EmailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
