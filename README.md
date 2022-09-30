view live at: www.common--room.com


## Workflow
1. Make sure you aren't behind the remote branch.   
`git pull origin master --rebase`
    - If you get merge conflicts, your editor/IDE might have a tool to visually resolve them. Webstorm does and it's really useful. Once resolved, commit your changes with a random commit message, it will be undone in a bit.
2. Make your changes locally. When you're ready to test them, create a local commit. The message will only be read by you so it doesn't matter too much
3. `git push -f heroku master`
    - The -f flag forces your working copy to be uploaded exactly to the heroku repo. It's dangerous in theory because you're ignoring any changes that are in the remote branch but not in your local copy, but we don't care in this case because heroku is not the repo that we use to actually maintain our code, origin is. We're just using heroku to host.
4. Test your changes with as many commits as necessary to ensure it is working. 

### Checking in your changes
###### When you have confirmed your changes are working and you're ready to check them in, the following steps will squash all of the micro-commits that were likely necessary when testing with heroku into one commit in the origin repo that is more readable and solves a problem as a single commit.
1. `git log --oneline`
2. Copy the commit ID of the last commit that was pushed to the remote branch
3. `git reset --soft <commitID>`
4. `git add *`
5. `git commit`: Don't use the `-m` flag. Take a minute to write a detailed commit message explaining the problem you were solving, the solution you came to, anything else about your code change that would be useful for the team to know.
6. `git push origin master`

Das it.


#### Notes
- This workflow largely eliminates the need for working on a branch other than master, but it would work similarly if you were working on a different branch, just replace the word master in all steps except for the heroku push step with the branch you're on.
- Eventually, we'll have a separate heroku staging environment that we'll be able to push to without messing with the prod one but no need yet
- To clear heroku cache: `heroku repo:purge_cache -a facemix`
