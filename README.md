playground
==========
Anyone in our group can upload files.
To avoid unnecessary pull actions, make your own branch and update the branch only.
Don't modify the master branch.

# Introduction/はじめに
Write tips in this README when you find new ones for github.

この README に github を使っていて気づいた事をCSGの皆で書いていきましょう。

# Make your own branch/自分のブランチを作る

Click `Branch:master` button above.
Then you can input your branch name in the `Find or create a branch...` box.

このページの上に Branch:master というボタンがある。
これをクリックして Find or create a branch... の欄に新しいブランチ名（chiba など好きな名前）を入力する。

# Clone your branch/ブランチを clone する

`git clone -b <branch name> --single-branch git@github.com:csg-tokyo/playground.git`

# Upload your commits/commits を反映する

`git push`

# Note/注意事項
Don't do `git push origin master`.<br/>
**The master branch of playground will be modified.**

`git push origin master` とすると **playground が汚されてしまうので止めましょう**。
