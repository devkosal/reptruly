# removes private key file for ml repo
#!/bin/bash
FILE=~/.ssh/id_rsa_ml_github_repo
if [ -f "$FILE" ];
then
    # not currently used. commented out for safety.
    # rm $FILE
    echo "would have deleted $FILE"
else
    echo "$FILE not found"
fi
