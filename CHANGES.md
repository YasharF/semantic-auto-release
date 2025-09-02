## 1.3.0 - 2025-09-02

# [1.3.0](https://github.com/YasharF/semantic-auto-release/compare/v1.2.0...v1.3.0) (2025-09-02)


### Bug Fixes

* add checks and statuses read permissions ([190cf8b](https://github.com/YasharF/semantic-auto-release/commit/190cf8bd3d4ffae8ef1e82e73740ef001e08a243))
* add more debug code ([a3ea0d3](https://github.com/YasharF/semantic-auto-release/commit/a3ea0d39b4255e99b6b02a8d2eb81c70e9a585bf))
* add more debug code ([ee8aefe](https://github.com/YasharF/semantic-auto-release/commit/ee8aefee27792079f26b6e3da05555314548b554))
* adjust error message ([562130e](https://github.com/YasharF/semantic-auto-release/commit/562130eba0cc6dcf587f1fc76f7288c9caac4584))
* identify need for PAN ([e5571fa](https://github.com/YasharF/semantic-auto-release/commit/e5571fa758a21c678791c6f3e68470cd490e28bd))
* more debug code ([2ab74da](https://github.com/YasharF/semantic-auto-release/commit/2ab74da4a2639f94995ec6a6bd5f1599cad804f7))
* more debug code ([5427c02](https://github.com/YasharF/semantic-auto-release/commit/5427c028cd65ea0967626e19434775130b043b51))
* potential fix after full logging ([3d1434a](https://github.com/YasharF/semantic-auto-release/commit/3d1434a2b0c941e17a33d2ddf933ebcccb3dbd78))
* rewrite run-release check status detection ([2646c94](https://github.com/YasharF/semantic-auto-release/commit/2646c9413b2f27b38e9d21bcac3522f8f55287fb))
* switching to cli for status ([89bc474](https://github.com/YasharF/semantic-auto-release/commit/89bc4742188b404b8d39edd7ac36db64fa22d23e))
* sync templates ([f2b2e17](https://github.com/YasharF/semantic-auto-release/commit/f2b2e17f9c9d23a8a4e877c8131440e0478f4723))


### Features

* don't bug the user about credentials if we don't even need a new release ([ceb5b97](https://github.com/YasharF/semantic-auto-release/commit/ceb5b97dbe109e88f1f48bb66f4c77dce735e936))

## 1.2.0 - 2025-09-02

# [1.2.0](https://github.com/YasharF/semantic-auto-release/compare/v1.1.1...v1.2.0) (2025-09-02)


### Bug Fixes

* don't double run the conventional commits workflow ([25e8a56](https://github.com/YasharF/semantic-auto-release/commit/25e8a564d05d62103da2cd9399294a397ef0e383))
* pr title check workflow ([cd957e7](https://github.com/YasharF/semantic-auto-release/commit/cd957e7bc6354f3aa32ef88035a2b743d5cdf216))


### Features

* add commitlint to workflows ([9a30c33](https://github.com/YasharF/semantic-auto-release/commit/9a30c33e411558945c94cb325a5a99c3b6b4e271))
* add setup script ([6bcacbc](https://github.com/YasharF/semantic-auto-release/commit/6bcacbc8483550d99fa08cbeb49c89d539aebbfe))
* add support for protected default branch with status checks ([fa7779d](https://github.com/YasharF/semantic-auto-release/commit/fa7779dfa70d72007df79061d2a06e5b8c774c7d))

## 1.1.1 - 2025-09-01

## [1.1.1](https://github.com/YasharF/semantic-auto-release/compare/v1.1.0...v1.1.1) (2025-09-01)


### Bug Fixes

* fix typo ([c743b54](https://github.com/YasharF/semantic-auto-release/commit/c743b5454bc6c3c5f1f327966afa0e9409f7fbc7))

## 1.1.0 - 2025-08-31

# [1.1.0](https://github.com/YasharF/semantic-auto-release/compare/v1.0.1...v1.1.0) (2025-08-31)


### Bug Fixes

* sync main branch after merge ([0133b71](https://github.com/YasharF/semantic-auto-release/commit/0133b71c5e69aa7ac53e79e1043bf5d581af82bd))


### Features

* support default branchs other than main ([0ce7f27](https://github.com/YasharF/semantic-auto-release/commit/0ce7f27bba034ce06e37cbfaeb9e7d87eb6b854d))

## 1.0.1 - 2025-08-31

## [1.0.1](https://github.com/YasharF/semantic-auto-release/compare/v1.0.0...v1.0.1) (2025-08-31)


### Bug Fixes

* clean-up logging errors ([61c2e2d](https://github.com/YasharF/semantic-auto-release/commit/61c2e2df0d3a54a93acdc47827aa8b0cbd6b2106))

## 1.0.0 - 2025-08-31

# 1.0.0 (2025-08-31)


* feat!: remove pr version bump process ([70781f8](https://github.com/YasharF/semantic-auto-release/commit/70781f83d2e2ae86f73cb9e58c6dc219ce7d5d01))


### Bug Fixes

* add checks permission to workflow ([c10b6bd](https://github.com/YasharF/semantic-auto-release/commit/c10b6bd77e5878004967fff247ca194d000f58b0))
* add issue write permission ([aef9435](https://github.com/YasharF/semantic-auto-release/commit/aef9435f6cc517319e3c5498cd404fdcb0778656))
* add missing GH_TOKEN, fast fail if unrelated PR ([446c428](https://github.com/YasharF/semantic-auto-release/commit/446c428f4cb22a923c802c67b9f45f10f8e7f3ed))
* add missing permissions and credentials ([2693ab6](https://github.com/YasharF/semantic-auto-release/commit/2693ab61ad52550e245f5a300eb83b9cb106cc0c))
* adjust push to main workflow ([0047416](https://github.com/YasharF/semantic-auto-release/commit/0047416ae0506644ae9389f10f32492c1d91e347))
* changes not change ([fe3d46a](https://github.com/YasharF/semantic-auto-release/commit/fe3d46a1611125f33c5938fdba6cbc376c99e4b4))
* consumers need to have issue:write permission ([7c93ea7](https://github.com/YasharF/semantic-auto-release/commit/7c93ea713d1c13d67ba0d7c4bdb772ba9c60a02e))
* correct .husky/commit-msg permissions ([40bef93](https://github.com/YasharF/semantic-auto-release/commit/40bef93951e4cc7daafee681918037d8e72f6c4c))
* don't skip PR checks ([1dd71e7](https://github.com/YasharF/semantic-auto-release/commit/1dd71e72cff33fd879330aa3c6895a9db4cb6b8b))
* permissions on run-release scirpt ([6e8cd5a](https://github.com/YasharF/semantic-auto-release/commit/6e8cd5adc0512ef4ba9c257f6292a2d459fa786c))
* potential fix for commitlint config export ([a554b40](https://github.com/YasharF/semantic-auto-release/commit/a554b4036925af9fc5a8e8e565affdf081cf5ae5))
* pr before merge for publish ver update ([d33c2c4](https://github.com/YasharF/semantic-auto-release/commit/d33c2c406dba1fa40fe1cad201dc2189a491ebd5))
* push before semantic-release ([d3fb64d](https://github.com/YasharF/semantic-auto-release/commit/d3fb64d472e32083f74e00755d77fbc751a26cb3))
* push to origin ([e6d3157](https://github.com/YasharF/semantic-auto-release/commit/e6d3157795eb5bf9d681511965a6de4abda981c4))
* remove tags ([7b227e4](https://github.com/YasharF/semantic-auto-release/commit/7b227e481c750ae382f46795bd5f070c5140a7eb))
* set .npmrc if needed ([a42027e](https://github.com/YasharF/semantic-auto-release/commit/a42027ee4e93486fa7ca3f2a3782747796423a13))
* set github credentials ([c4756a3](https://github.com/YasharF/semantic-auto-release/commit/c4756a3b540116e19ba88cbea3a4c4d76d4d9c33))
* set NODE_AUTH_TOKEN env variable ([c02077c](https://github.com/YasharF/semantic-auto-release/commit/c02077c6d1d10a256ab6004ef14033999fbcbd5e))
* syntax error ([579aa44](https://github.com/YasharF/semantic-auto-release/commit/579aa444643f07149843ff9c259a21a6dbbed7ce))
* trigger and PR workflow ([b7830e4](https://github.com/YasharF/semantic-auto-release/commit/b7830e4b4d181075937d5f08fefe1ec838ffdc08))
* use GH_TOKEN for Github CLI ([4aec16f](https://github.com/YasharF/semantic-auto-release/commit/4aec16fce7e07726d06d8fb1c4bf020b5ffe53ee))
* use main when calculating versions ([8367e42](https://github.com/YasharF/semantic-auto-release/commit/8367e42f6060a69bf1bfef84a94cd3705b70ae11))
* use pr close instead of push for publish ([7c097cd](https://github.com/YasharF/semantic-auto-release/commit/7c097cd98095ec46c89638fb13152dd8abeaba81))
* use proper path for package.json ([eafa942](https://github.com/YasharF/semantic-auto-release/commit/eafa9422770ca57e9beb1a4a92a59f888223bd8c))
* use temp branch for the local branch ([ee9eaff](https://github.com/YasharF/semantic-auto-release/commit/ee9eaff5ac30c08e5958aea29f3c7c7fc22e9d83))


### Features

* customize changelog name and format ([839bf67](https://github.com/YasharF/semantic-auto-release/commit/839bf6766fae3ad4038a9180fdaa3fedd6b1ee94))
* rename CHANGELOG.md to CHANGES.md ([90982b0](https://github.com/YasharF/semantic-auto-release/commit/90982b039ff01f1ce43ccb62d2dd581b02c9fb79))
* rewite to handle token permission scopes ([8bda65a](https://github.com/YasharF/semantic-auto-release/commit/8bda65a8c79eb933b45174ab605ee9ea30ba1d89))
* single file yml distribution ([95c3488](https://github.com/YasharF/semantic-auto-release/commit/95c34880e6cdf5d6e6b63931671ca1978636c3fa))
* update for process using limited semantic-release ([f5228eb](https://github.com/YasharF/semantic-auto-release/commit/f5228ebaafb9585625b36469eeb341fb80438211))
* use a ephemeral branch ([09057d6](https://github.com/YasharF/semantic-auto-release/commit/09057d6a10d8f7cb2db4a29bddbfd9d002ad3232))
* use a protected auto_release workflow ([9b57395](https://github.com/YasharF/semantic-auto-release/commit/9b57395a9d864bbed2b6b896c610c89b1161ed9b))
* use reusable bash script instead of yml ([30c0e8a](https://github.com/YasharF/semantic-auto-release/commit/30c0e8af951e93d23923a26dc3fb0388da681d15))


### BREAKING CHANGES

* This is a full overhaul. Read Readme for current usage.

## 2.2.2 - 2025-08-31

## [2.2.2](https://github.com/YasharF/semantic-auto-release/compare/v2.2.1...v2.2.2) (2025-08-31)


### Bug Fixes

* set .npmrc if needed ([a42027e](https://github.com/YasharF/semantic-auto-release/commit/a42027ee4e93486fa7ca3f2a3782747796423a13))

## 2.2.1 - 2025-08-31

## [2.2.1](https://github.com/YasharF/semantic-auto-release/compare/v2.2.0...v2.2.1) (2025-08-31)


### Bug Fixes

* set NODE_AUTH_TOKEN env variable ([c02077c](https://github.com/YasharF/semantic-auto-release/commit/c02077c6d1d10a256ab6004ef14033999fbcbd5e))

## 2.2.0 - 2025-08-31

# [2.2.0](https://github.com/YasharF/semantic-auto-release/compare/v2.1.1...v2.2.0) (2025-08-31)


### Bug Fixes

* add checks permission to workflow ([c10b6bd](https://github.com/YasharF/semantic-auto-release/commit/c10b6bd77e5878004967fff247ca194d000f58b0))
* add missing GH_TOKEN, fast fail if unrelated PR ([446c428](https://github.com/YasharF/semantic-auto-release/commit/446c428f4cb22a923c802c67b9f45f10f8e7f3ed))
* adjust push to main workflow ([0047416](https://github.com/YasharF/semantic-auto-release/commit/0047416ae0506644ae9389f10f32492c1d91e347))
* don't skip PR checks ([1dd71e7](https://github.com/YasharF/semantic-auto-release/commit/1dd71e72cff33fd879330aa3c6895a9db4cb6b8b))
* permissions on run-release scirpt ([6e8cd5a](https://github.com/YasharF/semantic-auto-release/commit/6e8cd5adc0512ef4ba9c257f6292a2d459fa786c))
* push to origin ([e6d3157](https://github.com/YasharF/semantic-auto-release/commit/e6d3157795eb5bf9d681511965a6de4abda981c4))
* remove tags ([7b227e4](https://github.com/YasharF/semantic-auto-release/commit/7b227e481c750ae382f46795bd5f070c5140a7eb))
* set github credentials ([c4756a3](https://github.com/YasharF/semantic-auto-release/commit/c4756a3b540116e19ba88cbea3a4c4d76d4d9c33))
* use proper path for package.json ([eafa942](https://github.com/YasharF/semantic-auto-release/commit/eafa9422770ca57e9beb1a4a92a59f888223bd8c))
* use temp branch for the local branch ([ee9eaff](https://github.com/YasharF/semantic-auto-release/commit/ee9eaff5ac30c08e5958aea29f3c7c7fc22e9d83))


### Features

* update for process using limited semantic-release ([f5228eb](https://github.com/YasharF/semantic-auto-release/commit/f5228ebaafb9585625b36469eeb341fb80438211))
* use a protected auto_release workflow ([9b57395](https://github.com/YasharF/semantic-auto-release/commit/9b57395a9d864bbed2b6b896c610c89b1161ed9b))
* use reusable bash script instead of yml ([30c0e8a](https://github.com/YasharF/semantic-auto-release/commit/30c0e8af951e93d23923a26dc3fb0388da681d15))

# Changes

## [2.1.1](https://github.com/YasharF/semantic-auto-release/compare/v2.1.0...v2.1.1) (2025-08-31)


### Bug Fixes

* use main when calculating versions ([8367e42](https://github.com/YasharF/semantic-auto-release/commit/8367e42f6060a69bf1bfef84a94cd3705b70ae11))
* use pr close instead of push for publish ([7c097cd](https://github.com/YasharF/semantic-auto-release/commit/7c097cd98095ec46c89638fb13152dd8abeaba81))

## [2.0.5](https://github.com/YasharF/semantic-auto-release/compare/v2.0.4...v2.0.5) (2025-08-30)

## [2.0.4](https://github.com/YasharF/semantic-auto-release/compare/v2.0.3...v2.0.4) (2025-08-30)


### Bug Fixes

* potential fix for commitlint config export ([a554b40](https://github.com/YasharF/semantic-auto-release/commit/a554b4036925af9fc5a8e8e565affdf081cf5ae5))

## [2.0.3](https://github.com/YasharF/semantic-auto-release/compare/v2.0.2...v2.0.3) (2025-08-30)


### Bug Fixes

* correct .husky/commit-msg permissions ([40bef93](https://github.com/YasharF/semantic-auto-release/commit/40bef93951e4cc7daafee681918037d8e72f6c4c))

## [2.0.2](https://github.com/YasharF/semantic-auto-release/compare/v2.0.1...v2.0.2) (2025-08-27)


### Bug Fixes

* add issue write permission ([aef9435](https://github.com/YasharF/semantic-auto-release/commit/aef9435f6cc517319e3c5498cd404fdcb0778656))
* consumers need to have issue:write permission ([7c93ea7](https://github.com/YasharF/semantic-auto-release/commit/7c93ea713d1c13d67ba0d7c4bdb772ba9c60a02e))

## [2.0.1](https://github.com/YasharF/semantic-auto-release/compare/v2.0.0...v2.0.1) (2025-08-27)


### Bug Fixes

* changes not change ([fe3d46a](https://github.com/YasharF/semantic-auto-release/commit/fe3d46a1611125f33c5938fdba6cbc376c99e4b4))

# [2.0.0](https://github.com/YasharF/semantic-auto-release/compare/v1.0.0...v2.0.0) (2025-08-27)


* feat!: remove pr version bump process ([70781f8](https://github.com/YasharF/semantic-auto-release/commit/70781f83d2e2ae86f73cb9e58c6dc219ce7d5d01))


### Features

* rename CHANGELOG.md to CHANGES.md ([90982b0](https://github.com/YasharF/semantic-auto-release/commit/90982b039ff01f1ce43ccb62d2dd581b02c9fb79))


### BREAKING CHANGES

* This is a full overhaul. Read Readme for current usage.

# 1.0.0 (2025-08-27)

### Bug Fixes

- pr before merge for publish ver update ([d33c2c4](https://github.com/YasharF/semantic-auto-release/commit/d33c2c406dba1fa40fe1cad201dc2189a491ebd5))
- syntax error ([579aa44](https://github.com/YasharF/semantic-auto-release/commit/579aa444643f07149843ff9c259a21a6dbbed7ce))

### Features

- single file yml distribution ([95c3488](https://github.com/YasharF/semantic-auto-release/commit/95c34880e6cdf5d6e6b63931671ca1978636c3fa))

## 0.0.1

- Initial release
