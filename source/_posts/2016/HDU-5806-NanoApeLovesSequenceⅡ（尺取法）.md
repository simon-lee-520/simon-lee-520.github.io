---
title: HDU-5806-NanoApeLovesSequenceⅡ（尺取法）
copyright_type: original
comments: true
date: '2016-08-20 15:58:55'
tags:
- hdu
- 尺取法
categories:
- ACM
abbrlink: be05574c
updated: '2016-08-20 15:58:55'
---

##  NanoApe Loves Sequence Ⅱ

**Time Limit: 4000/2000 MS (Java/Others) Memory Limit: 262144/131072 K (Java/Others)  
Total Submission(s): 1348 Accepted Submission(s): 588  
**   
  


Problem Description 

NanoApe, the Retired Dog, has returned back to prepare for for the National Higher Education Entrance Examination!   
  
In math class, NanoApe picked up sequences once again. He wrote down a sequence with  n numbers and a number  m on the paper.   
  
Now he wants to know the number of continous subsequences of the sequence in such a manner that the  k -th largest number in the subsequence is no less than  m .   
  
Note : The length of the subsequence must be no less than  k . 

  


Input 

The first line of the input contains an integer  T , denoting the number of test cases.   
  
In each test case, the first line of the input contains three integers  n,m,k .   
  
The second line of the input contains  n integers  A1,A2,...,An , denoting the elements of the sequence.   
  
1≤T≤10, 2≤n≤200000, 1≤k≤n/2, 1≤m,Ai≤109

  


Output 

For each test case, print a line with one integer, denoting the answer. 

  


Sample Input 
    
    
      
    
    
       1
    7 4 2
    4 2 7 7 6 5 1
      

  


Sample Output 
    
    
      
    
    
       18
      

  


Source 

[BestCoder Round #86](http://acm.split.hdu.edu.cn/search.php?field=problem&key=BestCoder+Round+%2386&source=1&searchmode=source)

  


尺取法:  
整个过程分为4步：  
1.初始化左右端点  
2.不断扩大右端点，直到满足条件  
3.如果第二步中无法满足条件，则终止，否则更新结果  
4.将左端点扩大1，然后回到第二步  

    
    
    #include <stdio.h>
    int a[200010];
    int main(){
        int t,i;
        int n,m,k;
        int l,r,tmp;
        long long sum;
    
        scanf("%d",&t);
        while(t--){
            scanf("%d%d%d",&n,&m,&k);
            for(i=0;i<n;i++){
                scanf("%d",a+i);
            }
            sum=tmp=l=r=0;
            while(1){
                if(r>=n)    break;
                while(1){
                    if(r>=n)    break;
                    if(a[r]>=m){
                        tmp++;
                    }
                    if(tmp==k){
                        sum+=(n-r);
                        break;
                    }
                    r++;
                }
                if(r>=n)    break;
                while(1){
                    if(l>r)    break;
                    if(a[l]<m){
                        sum+=(n-r);
                    }
                    else{
                        l++;
                        tmp--;
                        break;
                    }
                    l++;
                }
                r++;
            }
            printf("%lld\n",sum);
        }
        return 0;
    }

  


别人的代码：

  


代码1：
    
    
    #include <cstdio>
    #define N 200050
    int a[N];
    long long d[N];
    int main()
    {
        int T,n,m,k;
        scanf("%d",&T);
        while(T--){
            scanf("%d %d %d",&n,&m,&k);
            int t=0;
            long long sum=0;
            for(int i=1; i<=n; i++){
                scanf("%d",&a[i]);
                if(a[i]>=m){
                    d[++t]=i;
                    if(t>=k){
                        if(t==k) sum+=d[1]*(n-i+1);
                        else sum+=(d[t-k+1]-d[t-k])*(n-i+1);
                    }
                }
            }
            printf("%lld\n",sum);
        }
        return 0;
    }


代码2：
    
    
    #include <cstdio>
    #define N 200050
    int a[N];
    int main(){
        int T,n,m,k;
        scanf("%d",&T);
        while(T--){
            scanf("%d %d %d",&n,&m,&k);
            int t=0;
            long long sum=0;
            for(int i=1; i<=n; i++)
                scanf("%d",&a[i]);
            int r=1,num=0;
            for(int i=1;i<=n;i++){
                while(r<=n&&num<k){
                    if(a[r]>=m) num++;
                    r++;
                }
                if(num>=k) sum+=n-r+2;
                if(a[i]>=m) num--;
            }
            printf("%lld\n",sum);
        }
        return 0;
    }

  


代码3：
    
    
    #include <cstdio>
    const int MAXN = 200000 + 9;
    int a[MAXN];
    void solve(){
        int n, m, k;
        scanf("%d%d%d", &n, &m, &k);
        for (int i = 0; i < n; i++){
            scanf("%d", &a[i]);
        }
        long long ans = 0;
        int r;
        int t = 0;
        for (r = 0; r < n; r++) {
            if (a[r] >= m) t++;
            if (t == k) break;
        }
        ans += (n - r);
        for (int l = 1; l < n; l++) {
            if (a[l - 1] >= m) {
                t--;
                r++;
                for (;r < n; r++) {
                    if (a[r] >= m) t++;
                    if (t == k) break;
                }
                if (r >= n) break;
                ans += (n - r);
            } else {
                ans += (n - r);
            }
        }
        cout << ans << endl;
    }
    int main(){
        //freopen("in", "r", stdin);
        int t;
        scanf("%d",&t);
        while(t--){
            solve();
        }
    }
