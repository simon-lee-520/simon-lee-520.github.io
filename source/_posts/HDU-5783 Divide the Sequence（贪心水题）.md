---
title: HDU-5783 Divide the Sequence（贪心水题）
comments: true
date: '2016-08-20 15:39:29'
tags:
- hdu
- 贪心
categories:
- ACM
abbrlink: 2ca30c2
updated: '2016-08-20 15:39:29'
---

##  Divide the Sequence

**Time Limit: 5000/2500 MS (Java/Others) Memory Limit: 65536/65536 K (Java/Others)  
Total Submission(s): 1175 Accepted Submission(s): 563  
**   
  


Problem Description 

Alice has a sequence A, She wants to split A into as much as possible continuous subsequences, satisfying that for each subsequence, every its prefix sum is not small than 0. 

  


Input 

The input consists of multiple test cases.   
Each test case begin with an integer n in a single line.   
The next line contains n integers A_{1},A_{2}\cdots A_{n}.   
1 \leq n \leq 1e6   
-10000 \leq A[i] \leq 10000   
You can assume that there is at least one solution. 

  


Output 

For each test case, output an integer indicates the maximum number of sequence division. 

  


Sample Input 
    
    
      
    
    
       6
    1 2 3 4 5 6
    4
    1 2 -3 0
    5
    0 0 0 0 0
      

  


Sample Output 
    
    
      
    
    
       6
    2
    5
      

  


Author 

ZSTU 

  


Source 

[2016 Multi-University Training Contest 5](http://acm.split.hdu.edu.cn/search.php?field=problem&key=2016+Multi-University+Training+Contest+5&source=1&searchmode=source)

  


题意：给你一个序列，让你尽可能分成更多的子序列。使得每个子序列的前缀和   
都大于或等于0 。输出这个的子序列的总个数。   
  
  
题解：倒序遍历序列。如果遇到的是正数，那它就是一个符合条件的子序列，如果   
是负数，那就继续往前遍历，直到前缀和大于等于0，就是又一个符合条件的子序列。   


  
  

    
    
    /**
    * @Author: Simon
    * @Date:   2016-07-26 09-25-15
    * @Project: ACM
    * @Last modified by:   Simon
    * @Last modified time: 2016-08-20 01-36-50
    */
    /*
            ┆ ┏┓　　　┏┓ ┆
            ┆┏┛┻━━━━━━┛┻┓  ┆
            ┆┃　　　　　 ┃ ┆
            ┆┃　    ━　　┃ ┆
            ┆┃　┳┛　┗┳  ┃ ┆
            ┆┃　　　　　 ┃ ┆
            ┆┃　　　┻　　┃ ┆
            ┆┗━┓　  　┏━┛ ┆
            ┆　┃　  　┃　　┆　　　　　　
            ┆　┃　  　┗━━━┓ ┆
            ┆　┃　 AC代马  ┣┓┆
            ┆　┃　        ┏┛┆
            ┆　┗┓┓ ┏━┳┓ ┏┛ ┆
            ┆　　┃┫┫　┃┫┫ ┆
            ┆　　┗┻┛　┗┻┛ ┆
    */
    
    #include <iostream>
    #include <cstdio>
    #include <cstring>
    #include <string>
    #include <cmath>
    #include <cstdlib>
    #include <stack>
    #include <deque>
    #include <queue>
    #include <map>
    #include <set>
    #include <vector>
    #include <algorithm>
    using namespace std;
    
    #define MAX 1000010
    #define PI (acos(-1.0))
    #define LL long long
    #define Swap(a, b) (a ^= b, b ^= a, a ^= b)
    #define Max(a,b) ((a)>(b)?(a):(b))
    #define Min(a,b) ((a)<(b)?(a):(b))
    #define Abs(a)  ((a)>0?(a):-(a))
    #define Fabs(a) ((a)>0?(a):-(a))
    
    const int INF = 0x3f3f3f3f;
    const LL INFL = 0x3f3f3f3f3f3f3f3fll;
    const LL MOD = 1000000007;
    
    LL gcd(LL a,LL b){return b==0?a:gcd(b,a%b);}
    void exgcd(LL a,LL b,LL &x,LL &y){if(!b){x=1;y=0;return;}exgcd(b,a%b,y,x);y-=x*(a/b);}
    LL ksm(LL a,LL b){
        LL res=1;
        a%=MOD;
        for(;b;b>>=1){
            if(b&1)res=res*a%MOD;
            a=a*a%MOD;
        }
        return res;
    }
    
    int a[MAX];
    bool flag[MAX];
    int main(){
        //freopen("in.txt","r",stdin);
        int n,i,j;
        LL sum;
        while(~scanf("%d",&n)){
            for(i=1;i<=n;i++){
                scanf("%d",a+i);
            }
            sum=0;
            for(i=n;i>=1;i--){
                if(a[i]>=0) sum++;
                else{
                    LL tmp=a[i];
                    for(j=i-1;j>=1;j--){
                        tmp+=a[j];
                        if(tmp>=0){
                            sum++;
                            i=j;
                            break;
                        }
                    }
                }
            }
            printf("%lld\n",sum);
        }
        return 0;
    }
    
    /*
                       _ooOoo_
                      o8888888o
                      88" . "88
                      (| -_- |)
                      O\  =  /O
                   ____/`---'\____
                 .'  \\|     |//  `.
                /  \\|||  :  |||//  \
               /  _||||| -:- |||||-  \
               |   | \\\  -  /// |   |
               | \_|  ''\---/''  |   |
               \  .-\__  `-`  ___/-. /
             ___`. .'  /--.--\  `. . __
          ."" '<  `.___\_<|>_/___.'  >'"".
         | | :  `- \`.;`\ _ /`;.`/ - ` : | |
         \  \ `-.   \_ __\ /__ _/   .-` /  /
    ======`-.____`-.___\_____/___.-`____.-'======
                       `=---='
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                佛祖保佑       BUG全无
                佛祖镇楼       AC永驻
    */
