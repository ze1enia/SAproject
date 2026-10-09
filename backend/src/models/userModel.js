const users = [];

const userModel = {
    findByEmail: async (email) => {
        return users.find((user) => user.email === email);
    },

    findById: async (id) => {
        return users.find((user) => user.id === id)
    },

    create: async (userData) => {
        const newUser = {
            id: Date.now().toString(),
            email: userData.email,
            password: userData.password,
            name: userData.name || 'User',
            createAt: new Date() 

        };
        users.push(newUser);
        return newUser;
    }
};

module.exports = userModel;