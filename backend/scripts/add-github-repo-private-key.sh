# takes path to private key file for a repository and adds it to config. only supports one
# https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys

# https://superuser.com/questions/232373/how-to-tell-git-which-private-key-to-use
# cp $1 ~/.ssh/id_rsa_github
mkdir -p ~/.ssh && cp $1 ~/.ssh/id_rsa_ml_github_repo

touch ~/.ssh/known_hosts && ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

echo "Host github.com-ml-repo
 HostName github.com
 IdentityFile ~/.ssh/id_rsa_ml_github_repo" >> ~/.ssh/config

# https://superuser.com/questions/1212402/bad-owner-or-permissions-on-ssh-config-file
chmod 700 ~/.ssh
chmod 600 ~/.ssh/*

# post install, you can run something like:
# pip install -I git+ssh://git@github.com-ml-repo/Adevu-Tech/ml.git
